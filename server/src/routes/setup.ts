import { Hono } from "hono";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "../auth";
import { db, getOrg, isSetupComplete, publicUser } from "../db";

export const setupRoutes = new Hono();

setupRoutes.get("/status", (c) => {
  const org = getOrg();
  return c.json({
    setupComplete: isSetupComplete(),
    org: org ? { name: org.name } : null,
  });
});

setupRoutes.post("/", async (c) => {
  if (isSetupComplete()) {
    return c.json({ error: "Setup already completed" }, 409);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const orgName =
    typeof body.orgName === "string" ? body.orgName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim()
      : email.split("@")[0] || "Admin";

  if (orgName.length < 1 || orgName.length > 100) {
    return c.json({ error: "Organization name must be 1–100 characters" }, 400);
  }
  if (!isValidEmail(email)) {
    return c.json({ error: "Valid email is required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    const tx = db.transaction(() => {
      // Re-check inside the transaction to close the concurrent-setup race
      const already = db.query("SELECT 1 AS ok FROM org WHERE id = 1").get() as
        | { ok: number }
        | null;
      if (already) {
        throw Object.assign(new Error("Setup already completed"), {
          status: 409,
        });
      }
      db.query("INSERT INTO org (id, name) VALUES (1, ?)").run(orgName);
      db.query(
        `INSERT INTO users (id, email, password_hash, display_name, role, must_change_password)
         VALUES (?, ?, ?, ?, 'admin', 0)`,
      ).run(userId, email.toLowerCase(), passwordHash, displayName);
    });
    tx();
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 409 || /UNIQUE|constraint/i.test(e.message)) {
      return c.json({ error: "Setup already completed" }, 409);
    }
    throw err;
  }

  const token = createSession(userId);
  setSessionCookie(c, token);

  const user = db
    .query("SELECT * FROM users WHERE id = ?")
    .get(userId) as import("../db").UserRow;

  return c.json({
    org: { name: orgName },
    user: publicUser(user),
  });
});

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
