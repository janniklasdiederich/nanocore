import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db, publicUser, type UserRow } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "nanocore_session";
const SESSION_DAYS = 30;
/** Short-lived token so WebSocket clients can auth without relying on cookies. */
const SYNC_TOKEN_TTL_MS = 2 * 60 * 1000;

export type AuthUser = ReturnType<typeof publicUser>;
type SessionUser = UserRow & { auth_session_id: string };

export type Variables = {
  user: AuthUser;
  userRow: SessionUser;
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

/** Invalidate every session for a user (e.g. after password change). */
export function destroyAllSessionsForUser(userId: string): void {
  db.query("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Drop expired session rows. Safe to call often. */
export function purgeExpiredSessions(): number {
  const result = db
    .query(`DELETE FROM sessions WHERE expires_at <= datetime('now')`)
    .run();
  return Number(result.changes ?? 0);
}

export function getUserFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;

  const row = db
    .query(
      `SELECT u.*, s.id AS auth_session_id FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    )
    .get(hashToken(token)) as SessionUser | null;

  return row;
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    // Only Secure over HTTPS — plain HTTP Docker would never set cookies if always true
    secure: env.cookieSecure,
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

/** Short-lived room ticket tied to the HTTP session that issued it. */
export function createSyncToken(authSessionId: string, boardId: string): string {
  const exp = Date.now() + SYNC_TOKEN_TTL_MS;
  const body = `${authSessionId}.${boardId}.${exp}`;
  const sig = createHmac("sha256", env.sessionSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function getSyncUserId(authSessionId: string): string | null {
  const row = db.query(
    `SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.must_change_password = 0`,
  ).get(authSessionId, new Date().toISOString()) as { user_id: string } | null;
  return row?.user_id ?? null;
}

export function verifySyncToken(
  token: string,
  boardId: string,
): { userId: string; authSessionId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [authSessionId, tokenBoardId, expStr, sig] = parts;
  if (!authSessionId || !tokenBoardId || !expStr || !sig) return null;
  if (tokenBoardId !== boardId) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  const body = `${authSessionId}.${tokenBoardId}.${expStr}`;
  const expected = createHmac("sha256", env.sessionSecret)
    .update(body)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const userId = getSyncUserId(authSessionId);
  return userId ? { userId, authSessionId } : null;
}

/** Permanent (secret-bound) signature so asset URLs work in <img> without cookies. */
export function signAssetFilename(filename: string): string {
  return createHmac("sha256", env.sessionSecret)
    .update(`asset:${filename}`)
    .digest("base64url");
}

export function verifyAssetSignature(
  filename: string,
  sig: string | undefined,
): boolean {
  if (!sig) return false;
  const expected = signAssetFilename(filename);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
