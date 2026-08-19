import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  clearSessionCookie,
  createSession,
  destroyAllSessionsForUser,
  destroySession,
  getUserFromToken,
  hashPassword,
  purgeExpiredSessions,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
  type Variables,
} from "../auth";
import { db, getOrg, publicOrg, publicUser, type UserRow } from "../db";
import { clientIp, rateLimit } from "../rateLimit";

export const authRoutes = new Hono<{ Variables: Variables }>();

authRoutes.get("/me", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  const userRow = getUserFromToken(token);
  const org = getOrg();

  if (!userRow) {
    return c.json({ user: null, org: publicOrg(org) });
  }

  return c.json({
    user: publicUser(userRow),
    org: publicOrg(org),
  });
});

authRoutes.post("/login", async (c) => {
  const ip = clientIp(c.req);
  if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
    return c.json({ error: "Too many login attempts. Try again later." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return c.json({ error: "Email and password required" }, 400);
  }

  // Opportunistic cleanup
  purgeExpiredSessions();

  const user = db
    .query("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as UserRow | null;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = createSession(user.id);
  setSessionCookie(c, token);

  const org = getOrg();
  return c.json({
    user: publicUser(user),
    org: publicOrg(org),
  });
});

authRoutes.post("/logout", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  destroySession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.post("/change-password", requireAuth, async (c) => {
  const userRow = c.get("userRow");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }

  if (!(await verifyPassword(currentPassword, userRow.password_hash))) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  db.query(
    `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`,
  ).run(passwordHash, userRow.id);

  // Invalidate all sessions (including this one), then mint a fresh session
  destroyAllSessionsForUser(userRow.id);
  const token = createSession(userRow.id);
  setSessionCookie(c, token);

  const updated = db
    .query("SELECT * FROM users WHERE id = ?")
    .get(userRow.id) as UserRow;

  return c.json({ user: publicUser(updated) });
});
