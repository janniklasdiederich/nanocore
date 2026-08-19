import { Hono } from "hono";
import {
  createSyncToken,
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import {
  listBoardAccess,
  listBoardsForUser,
  setBoardAccess,
  userCanAccessBoard,
} from "../boardAccess";
import { db, type BoardRow } from "../db";
import { closeRoom } from "../rooms";
import { kickUsersFromBoard } from "../wsConnections";

export const boardRoutes = new Hono<{ Variables: Variables }>();

boardRoutes.use("*", requireAuth);

function mapBoard(row: BoardRow) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** List boards the caller can open. Admins see all; members see assigned only. */
boardRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const user = c.get("user");
  const rows = listBoardsForUser(user.id, user.role);
  return c.json({ boards: rows.map(mapBoard) });
});

boardRoutes.get("/:id/members", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const existing = db.query("SELECT id FROM boards WHERE id = ?").get(id);
  if (!existing) return c.json({ error: "Board not found" }, 404);

  return c.json(listBoardAccess(id));
});

boardRoutes.put("/:id/members", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const existing = db.query("SELECT id FROM boards WHERE id = ?").get(id);
  if (!existing) return c.json({ error: "Board not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  if (!userIds) {
    return c.json({ error: "userIds array required" }, 400);
  }
  const groupIds = Array.isArray(body?.groupIds)
    ? body.groupIds.filter((v: unknown): v is string => typeof v === "string")
    : null;

  const granter = c.get("user");
  const { removedUserIds } = setBoardAccess(
    id,
    userIds,
    groupIds,
    granter.id,
  );
  kickUsersFromBoard(id, removedUserIds);

  return c.json(listBoardAccess(id));
});

boardRoutes.get("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const user = c.get("user");
  if (!userCanAccessBoard(user.id, id)) {
    return c.json({ error: "Board not found" }, 404);
  }

  const row = db
    .query("SELECT * FROM boards WHERE id = ?")
    .get(id) as BoardRow | null;

  if (!row) return c.json({ error: "Board not found" }, 404);
  return c.json({ board: mapBoard(row) });
});

/** Short-lived token for WebSocket upgrade. */
boardRoutes.post("/:id/sync-token", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const row = db.query("SELECT id FROM boards WHERE id = ?").get(id) as
    | { id: string }
    | null;
  if (!row) return c.json({ error: "Board not found" }, 404);

  const user = c.get("user");
  if (!userCanAccessBoard(user.id, id)) {
    return c.json({ error: "Board not found" }, 404);
  }

  const token = createSyncToken(user.id, row.id);
  return c.json({ token, expiresInSec: 120 });
});

/** Create / rename / delete: admin only. */
boardRoutes.post("/", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const body = await c.req.json().catch(() => null);
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Untitled board";

  if (name.length > 120) {
    return c.json({ error: "Name must be at most 120 characters" }, 400);
  }

  const id = crypto.randomUUID();
  const user = c.get("user");

  db.query(`INSERT INTO boards (id, name, created_by) VALUES (?, ?, ?)`).run(
    id,
    name,
    user.id,
  );

  const row = db.query("SELECT * FROM boards WHERE id = ?").get(id) as BoardRow;
  return c.json({ board: mapBoard(row) }, 201);
});

boardRoutes.patch("/:id", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const existing = db
    .query("SELECT * FROM boards WHERE id = ?")
    .get(id) as BoardRow | null;
  if (!existing) return c.json({ error: "Board not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const name =
    typeof body?.name === "string" ? body.name.trim() : existing.name;
  if (!name || name.length > 120) {
    return c.json({ error: "Invalid name" }, 400);
  }

  db.query(
    `UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(name, id);

  const row = db.query("SELECT * FROM boards WHERE id = ?").get(id) as BoardRow;
  return c.json({ board: mapBoard(row) });
});

boardRoutes.delete("/:id", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);

  const existing = db.query("SELECT id FROM boards WHERE id = ?").get(id);
  if (!existing) return c.json({ error: "Board not found" }, 404);

  // Tear down live collab room before deleting the row (no re-persist after delete)
  closeRoom(id, { persist: false });
  db.query("DELETE FROM boards WHERE id = ?").run(id);
  return c.json({ ok: true });
});
