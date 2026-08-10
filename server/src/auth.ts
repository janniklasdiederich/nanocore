import { createHash, randomBytes } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db, publicUser, type UserRow } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "nanocore_session";
const SESSION_DAYS = 30;

export type AuthUser = ReturnType<typeof publicUser>;

export type Variables = {
  user: AuthUser;
  userRow: UserRow;
};

function hashToken(token: string): string {
  return createHash("sha256")
    .update(`${env.sessionSecret}:${token}`)
    .digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);

  db.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(id, userId, hashToken(token), expires.toISOString());

  return token;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function getUserFromToken(token: string | undefined): UserRow | null {
  if (!token) return null;

  const row = db
    .query(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    )
    .get(hashToken(token)) as UserRow | null;

  return row;
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  const userRow = getUserFromToken(token);
  if (!userRow) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userRow", userRow);
  c.set("user", publicUser(userRow));
  await next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user") as AuthUser | undefined;
  if (!user || user.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }
  await next();
}

/** Allow password-change flow even when mustChangePassword is true. */
export async function requireAuthAllowPasswordChange(c: Context, next: Next) {
  return requireAuth(c, next);
}

export function requirePasswordOk(c: Context) {
  const user = c.get("user") as AuthUser;
  if (user.mustChangePassword) {
    return c.json(
      { error: "Password change required", code: "MUST_CHANGE_PASSWORD" },
      403,
    );
  }
  return null;
}
