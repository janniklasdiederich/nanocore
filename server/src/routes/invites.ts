import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import {
  createSession,
  hashPassword,
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  setSessionCookie,
  type Variables,
} from "../auth";
import { db, getOrg, isSetupComplete, publicUser, type UserRow } from "../db";
import { env } from "../env";

export type InviteRow = {
  id: string;
  token_hash: string;
  created_by: string | null;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
};

function hashInviteToken(token: string): string {
  return createHash("sha256")
    .update(`${env.sessionSecret}:invite:${token}`)
    .digest("hex");
}

function mapInvite(row: InviteRow, plainToken?: string) {
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const usesExhausted =
    row.max_uses !== null && row.use_count >= row.max_uses;
  const revoked = Boolean(row.revoked_at);
  const active = !expired && !usesExhausted && !revoked;

  return {
    id: row.id,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    active,
    status: revoked
      ? ("revoked" as const)
      : expired
        ? ("expired" as const)
        : usesExhausted
          ? ("exhausted" as const)
          : ("active" as const),
    // Only returned once at creation
    ...(plainToken
      ? {
          token: plainToken,
          path: `/invite/${plainToken}`,
        }
      : {}),
  };
}

function getInviteByToken(plainToken: string): InviteRow | null {
  return db
    .query("SELECT * FROM invite_links WHERE token_hash = ?")
    .get(hashInviteToken(plainToken)) as InviteRow | null;
}

function inviteUsable(row: InviteRow): { ok: true } | { ok: false; error: string; code: string } {
  if (row.revoked_at) {
    return { ok: false, error: "This invite has been revoked", code: "REVOKED" };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This invite has expired", code: "EXPIRED" };
  }
  if (row.max_uses !== null && row.use_count >= row.max_uses) {
    return {
      ok: false,
      error: "This invite has reached its use limit",
      code: "EXHAUSTED",
    };
  }
  return { ok: true };
}

/** Admin-only management of invite links */
export const inviteAdminRoutes = new Hono<{ Variables: Variables }>();

inviteAdminRoutes.use("*", requireAuth, requireAdmin);

inviteAdminRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const rows = db
    .query(
      `SELECT * FROM invite_links ORDER BY created_at DESC LIMIT 100`,
    )
    .all() as InviteRow[];

  return c.json({ invites: rows.map((r) => mapInvite(r)) });
});

inviteAdminRoutes.post("/", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  // expiresAt: ISO string required
  const expiresAtRaw =
    typeof body.expiresAt === "string" ? body.expiresAt.trim() : "";
  const expiresAt = new Date(expiresAtRaw);
  if (!expiresAtRaw || Number.isNaN(expiresAt.getTime())) {
    return c.json({ error: "Valid expiresAt (ISO date) is required" }, 400);
  }
  if (expiresAt.getTime() <= Date.now()) {
    return c.json({ error: "Expiration must be in the future" }, 400);
  }
  // Cap at 1 year
  const maxHorizon = Date.now() + 366 * 24 * 60 * 60 * 1000;
  if (expiresAt.getTime() > maxHorizon) {
    return c.json({ error: "Expiration cannot be more than 1 year ahead" }, 400);
  }

  let maxUses: number | null = null;
  if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== "") {
    const n = Number(body.maxUses);
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      return c.json(
        { error: "maxUses must be an integer between 1 and 10000, or null" },
        400,
      );
    }
    maxUses = n;
  }

  const id = crypto.randomUUID();
  const plainToken = randomBytes(24).toString("base64url");
  const user = c.get("user");

  db.query(
    `INSERT INTO invite_links (id, token_hash, created_by, expires_at, max_uses, use_count)
     VALUES (?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    hashInviteToken(plainToken),
    user.id,
    expiresAt.toISOString(),
    maxUses,
  );

  const row = db
    .query("SELECT * FROM invite_links WHERE id = ?")
    .get(id) as InviteRow;

  return c.json({ invite: mapInvite(row, plainToken) }, 201);
});

inviteAdminRoutes.post("/:id/revoke", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  const row = db
    .query("SELECT * FROM invite_links WHERE id = ?")
    .get(id) as InviteRow | null;
  if (!row) return c.json({ error: "Invite not found" }, 404);
  if (row.revoked_at) {
    return c.json({ invite: mapInvite(row) });
  }

  db.query(
    `UPDATE invite_links SET revoked_at = datetime('now') WHERE id = ?`,
  ).run(id);

  const updated = db
    .query("SELECT * FROM invite_links WHERE id = ?")
    .get(id) as InviteRow;
  return c.json({ invite: mapInvite(updated) });
});

inviteAdminRoutes.delete("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  const existing = db
    .query("SELECT id FROM invite_links WHERE id = ?")
    .get(id);
  if (!existing) return c.json({ error: "Invite not found" }, 404);

  db.query("DELETE FROM invite_links WHERE id = ?").run(id);
  return c.json({ ok: true });
});

/** Public accept flow (no session required) */
export const invitePublicRoutes = new Hono();

invitePublicRoutes.get("/:token", (c) => {
  if (!isSetupComplete()) {
    return c.json({ error: "App is not set up yet", code: "NOT_SETUP" }, 503);
  }

  const token = c.req.param("token");
  if (!token || token.length < 16) {
    return c.json({ error: "Invalid invite", code: "INVALID" }, 404);
  }

  const row = getInviteByToken(token);
  if (!row) {
    return c.json({ error: "Invite not found", code: "NOT_FOUND" }, 404);
  }

  const check = inviteUsable(row);
  const org = getOrg();

  if (!check.ok) {
    return c.json(
      {
        valid: false,
        error: check.error,
        code: check.code,
        org: org ? { name: org.name } : null,
      },
      410,
    );
  }

  return c.json({
    valid: true,
    org: org ? { name: org.name } : null,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    remainingUses:
      row.max_uses === null ? null : Math.max(0, row.max_uses - row.use_count),
  });
});

invitePublicRoutes.post("/:token/accept", async (c) => {
  if (!isSetupComplete()) {
    return c.json({ error: "App is not set up yet" }, 503);
  }

  const token = c.req.param("token");
  if (!token || token.length < 16) {
    return c.json({ error: "Invalid invite" }, 404);
  }

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
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }
  if (displayName.length < 1 || displayName.length > 80) {
    return c.json({ error: "Display name must be 1–80 characters" }, 400);
  }

  const tokenHash = hashInviteToken(token);
  const passwordHash = await hashPassword(password);

  let createdUser: UserRow;
  try {
    const run = db.transaction(() => {
      const row = db
        .query("SELECT * FROM invite_links WHERE token_hash = ?")
        .get(tokenHash) as InviteRow | null;
      if (!row) {
        throw Object.assign(new Error("Invite not found"), { status: 404 });
      }
      const check = inviteUsable(row);
      if (!check.ok) {
        throw Object.assign(new Error(check.error), {
          status: 410,
          code: check.code,
        });
      }

      const existing = db
        .query("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
        .get(email);
      if (existing) {
        throw Object.assign(new Error("A user with that email already exists"), {
          status: 409,
        });
      }

      const userId = crypto.randomUUID();
      db.query(
        `INSERT INTO users (id, email, password_hash, display_name, role, must_change_password)
         VALUES (?, ?, ?, ?, 'member', 0)`,
      ).run(userId, email.toLowerCase(), passwordHash, displayName);

      db.query(
        `UPDATE invite_links SET use_count = use_count + 1 WHERE id = ?`,
      ).run(row.id);

      return db
        .query("SELECT * FROM users WHERE id = ?")
        .get(userId) as UserRow;
    });

    createdUser = run();
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    const status = (e.status ?? 400) as 400 | 404 | 409 | 410;
    return c.json(
      { error: e.message || "Could not accept invite", code: e.code },
      status,
    );
  }

  const sessionToken = createSession(createdUser.id);
  setSessionCookie(c, sessionToken);
  const org = getOrg();

  return c.json(
    {
      user: publicUser(createdUser),
      org: org ? { name: org.name } : null,
    },
    201,
  );
});
