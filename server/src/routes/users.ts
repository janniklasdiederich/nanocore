import { Hono } from "hono";
import {
  hashPassword,
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import { db, publicUser, type UserRow } from "../db";

export const userRoutes = new Hono<{ Variables: Variables }>();

userRoutes.use("*", requireAuth);

userRoutes.get("/", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const me = c.get("user");
  if (me.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }

  const rows = db
    .query(
      `SELECT id, email, password_hash, display_name, role, must_change_password, created_at
       FROM users ORDER BY created_at ASC`,
    )
    .all() as UserRow[];

  return c.json({ users: rows.map(publicUser) });
});

userRoutes.post("/", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim()
      : email.split("@")[0] || "User";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email is required" }, 400);
  }
  if (password.length < 8) {
    return c.json(
      { error: "Temporary password must be at least 8 characters" },
      400,
    );
  }
  if (displayName.length < 1 || displayName.length > 80) {
    return c.json({ error: "Display name must be 1–80 characters" }, 400);
  }

  const existing = db
    .query("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .get(email);
  if (existing) {
    return c.json({ error: "A user with that email already exists" }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  db.query(
    `INSERT INTO users (id, email, password_hash, display_name, role, must_change_password)
     VALUES (?, ?, ?, ?, 'member', 1)`,
  ).run(id, email.toLowerCase(), passwordHash, displayName);

  const user = db.query("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  return c.json({ user: publicUser(user) }, 201);
});

userRoutes.patch("/:id/role", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "User id required" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const role = body?.role;
  if (role !== "admin" && role !== "member") {
    return c.json({ error: "role must be 'admin' or 'member'" }, 400);
  }

  const target = db
    .query("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | null;
  if (!target) {
    return c.json({ error: "User not found" }, 404);
  }

  if (target.role === role) {
    return c.json({ user: publicUser(target) });
  }

  // Never leave the workspace without an admin
  if (target.role === "admin" && role === "member") {
    const adminCount = (
      db
        .query(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`)
        .get() as { n: number }
    ).n;
    if (adminCount <= 1) {
      return c.json({ error: "Cannot demote the last admin" }, 400);
    }
  }

  db.query(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
  const updated = db
    .query("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow;
  return c.json({ user: publicUser(updated) });
});

userRoutes.delete("/:id", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "User id required" }, 400);
  }
  const me = c.get("user");

  if (id === me.id) {
    return c.json({ error: "You cannot delete your own account" }, 400);
  }

  const target = db
    .query("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | null;
  if (!target) {
    return c.json({ error: "User not found" }, 404);
  }

  if (target.role === "admin") {
    const adminCount = (
      db
        .query(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`)
        .get() as { n: number }
    ).n;
    if (adminCount <= 1) {
      return c.json({ error: "Cannot delete the last admin" }, 400);
    }
  }

  db.query("DELETE FROM users WHERE id = ?").run(id);
  return c.json({ ok: true });
});
