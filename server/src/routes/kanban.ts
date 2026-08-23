import { Hono } from "hono";
import {
  createSyncToken,
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import {
  listKanbanAccess,
  listKanbanBoardsForUser,
  setKanbanAccess,
  userCanAccessKanban,
  type KanbanBoardRow,
} from "../kanbanAccess";
import { db } from "../db";
import { closeKanbanRoom } from "../kanbanRooms";
import {
  addCard,
  addColumn,
  addLabel,
  createKanbanBoard,
  deleteCard,
  deleteColumn,
  deleteLabel,
  isKanbanPriority,
  loadKanbanState,
  mapKanbanBoard,
  moveCard,
  renameColumn,
  reorderColumns,
  updateCard,
  updateLabel,
} from "../kanbanState";
import { kickUsersFromBoard } from "../wsConnections";

export const kanbanRoutes = new Hono<{ Variables: Variables }>();

kanbanRoutes.use("*", requireAuth);

function boardExists(id: string): KanbanBoardRow | null {
  return db.query("SELECT * FROM kanban_boards WHERE id = ?").get(id) as
    | KanbanBoardRow
    | null;
}

function cleanTitle(raw: unknown, fallback: string, max: number): string | null {
  const s = typeof raw === "string" ? raw.trim() : fallback;
  if (!s || s.length > max) return null;
  return s;
}

kanbanRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const user = c.get("user");
  const rows = listKanbanBoardsForUser(user.id, user.role);
  return c.json({ boards: rows.map(mapKanbanBoard) });
});

kanbanRoutes.post("/", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const body = await c.req.json().catch(() => null);
  const name = cleanTitle(body?.name, "Untitled kanban", 120);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  const columns = Array.isArray(body?.columns)
    ? body.columns
        .filter((t: unknown): t is string => typeof t === "string")
        .map((t: string) => t.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const user = c.get("user");
  const state = createKanbanBoard(name, user.id, columns);
  return c.json(state, 201);
});

kanbanRoutes.get("/:id/members", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !boardExists(id)) return c.json({ error: "Board not found" }, 404);
  return c.json(listKanbanAccess(id));
});

kanbanRoutes.put("/:id/members", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !boardExists(id)) return c.json({ error: "Board not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  if (!userIds) return c.json({ error: "userIds array required" }, 400);
  const groupIds = Array.isArray(body?.groupIds)
    ? body.groupIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  const granter = c.get("user");
  const { removedUserIds } = setKanbanAccess(
    id,
    userIds,
    groupIds,
    granter.id,
  );
  kickUsersFromBoard(`kanban:${id}`, removedUserIds);
  return c.json(listKanbanAccess(id));
});

kanbanRoutes.post("/:id/sync-token", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !boardExists(id)) return c.json({ error: "Board not found" }, 404);
  const user = c.get("user");
  if (!userCanAccessKanban(user.id, id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  return c.json({
    token: createSyncToken(user.id, id),
    expiresInSec: 120,
  });
});

kanbanRoutes.get("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Board id required" }, 400);
  const user = c.get("user");
  if (!userCanAccessKanban(user.id, id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const state = loadKanbanState(id);
  if (!state) return c.json({ error: "Board not found" }, 404);
  return c.json(state);
});

kanbanRoutes.patch("/:id", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const existing = id ? boardExists(id) : null;
  if (!existing) return c.json({ error: "Board not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const name = cleanTitle(body?.name, existing.name, 120);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  db.query(
    `UPDATE kanban_boards SET name = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(name, existing.id);
  const row = boardExists(existing.id)!;
  return c.json({ board: mapKanbanBoard(row) });
});

kanbanRoutes.delete("/:id", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !boardExists(id)) return c.json({ error: "Board not found" }, 404);
  closeKanbanRoom(id);
  db.query("DELETE FROM kanban_boards WHERE id = ?").run(id);
  return c.json({ ok: true });
});

kanbanRoutes.post("/:id/columns", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  if (!id || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const title = cleanTitle(body?.title, "", 80);
  if (!title) return c.json({ error: "Invalid title" }, 400);
  return c.json({ column: addColumn(id, title) }, 201);
});

kanbanRoutes.patch("/:id/columns/:colId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const colId = c.req.param("colId");
  const user = c.get("user");
  if (!id || !colId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const title = cleanTitle(body?.title, "", 80);
  if (!title) return c.json({ error: "Invalid title" }, 400);
  if (!renameColumn(id, colId, title)) {
    return c.json({ error: "Column not found" }, 404);
  }
  return c.json({ ok: true });
});

kanbanRoutes.put("/:id/column-order", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  if (!id || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const columnIds = Array.isArray(body?.columnIds)
    ? body.columnIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  if (!columnIds) return c.json({ error: "columnIds array required" }, 400);
  if (!reorderColumns(id, columnIds)) {
    return c.json({ error: "Invalid column order" }, 400);
  }
  return c.json({ ok: true });
});

kanbanRoutes.delete("/:id/columns/:colId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const colId = c.req.param("colId");
  const user = c.get("user");
  if (!id || !colId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  if (!deleteColumn(id, colId)) return c.json({ error: "Column not found" }, 404);
  return c.json({ ok: true });
});

kanbanRoutes.post("/:id/cards", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  if (!id || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const columnId = typeof body?.columnId === "string" ? body.columnId : "";
  const title = cleanTitle(body?.title, "", 200);
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  if (!columnId || !title) return c.json({ error: "Invalid card" }, 400);
  if (description.length > 4000) {
    return c.json({ error: "Description too long" }, 400);
  }
  const card = addCard(id, columnId, title, description, user.id);
  if (!card) return c.json({ error: "Column not found" }, 404);
  const extra: {
    priority?: (typeof card)["priority"];
    assigneeIds?: string[];
    labelIds?: string[];
  } = {};
  if (isKanbanPriority(body?.priority)) extra.priority = body.priority;
  if (Array.isArray(body?.assigneeIds)) {
    extra.assigneeIds = body.assigneeIds.filter(
      (v: unknown): v is string => typeof v === "string",
    );
  }
  if (Array.isArray(body?.labelIds)) {
    extra.labelIds = body.labelIds.filter(
      (v: unknown): v is string => typeof v === "string",
    );
  }
  if (Object.keys(extra).length) {
    updateCard(id, card.id, extra);
    const state = loadKanbanState(id);
    const fresh = state?.cards.find((c) => c.id === card.id);
    return c.json({ card: fresh ?? card }, 201);
  }
  return c.json({ card }, 201);
});

kanbanRoutes.patch("/:id/cards/:cardId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const cardId = c.req.param("cardId");
  const user = c.get("user");
  if (!id || !cardId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const fields: {
    title?: string;
    description?: string;
    priority?: "high" | "normal" | "low";
    assigneeIds?: string[];
    labelIds?: string[];
  } = {};
  if (typeof body?.title === "string") {
    const title = cleanTitle(body.title, "", 200);
    if (!title) return c.json({ error: "Invalid title" }, 400);
    fields.title = title;
  }
  if (typeof body?.description === "string") {
    if (body.description.trim().length > 4000) {
      return c.json({ error: "Description too long" }, 400);
    }
    fields.description = body.description.trim();
  }
  if (body?.priority !== undefined) {
    if (!isKanbanPriority(body.priority)) {
      return c.json({ error: "Invalid priority" }, 400);
    }
    fields.priority = body.priority;
  }
  if (body?.assigneeIds !== undefined) {
    if (!Array.isArray(body.assigneeIds)) {
      return c.json({ error: "assigneeIds array required" }, 400);
    }
    fields.assigneeIds = body.assigneeIds.filter(
      (v: unknown): v is string => typeof v === "string",
    );
  }
  if (body?.labelIds !== undefined) {
    if (!Array.isArray(body.labelIds)) {
      return c.json({ error: "labelIds array required" }, 400);
    }
    fields.labelIds = body.labelIds.filter(
      (v: unknown): v is string => typeof v === "string",
    );
  }
  if (!updateCard(id, cardId, fields)) {
    return c.json({ error: "Card not found" }, 404);
  }
  return c.json({ ok: true });
});

kanbanRoutes.post("/:id/labels", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  if (!id || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const name = cleanTitle(body?.name, "", 40);
  const color = typeof body?.color === "string" ? body.color.trim() : "";
  if (!name) return c.json({ error: "Invalid name" }, 400);
  const label = addLabel(id, name, color);
  if (!label) return c.json({ error: "Invalid color" }, 400);
  return c.json({ label }, 201);
});

kanbanRoutes.patch("/:id/labels/:labelId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const labelId = c.req.param("labelId");
  const user = c.get("user");
  if (!id || !labelId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const fields: { name?: string; color?: string } = {};
  if (typeof body?.name === "string") {
    const name = cleanTitle(body.name, "", 40);
    if (!name) return c.json({ error: "Invalid name" }, 400);
    fields.name = name;
  }
  if (typeof body?.color === "string") fields.color = body.color.trim();
  if (!updateLabel(id, labelId, fields)) {
    return c.json({ error: "Label not found" }, 404);
  }
  return c.json({ ok: true });
});

kanbanRoutes.delete("/:id/labels/:labelId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const labelId = c.req.param("labelId");
  const user = c.get("user");
  if (!id || !labelId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  if (!deleteLabel(id, labelId)) return c.json({ error: "Label not found" }, 404);
  return c.json({ ok: true });
});

kanbanRoutes.post("/:id/cards/:cardId/move", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const cardId = c.req.param("cardId");
  const user = c.get("user");
  if (!id || !cardId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const columnId = typeof body?.columnId === "string" ? body.columnId : "";
  const index = Number(body?.index);
  if (!columnId || !Number.isFinite(index)) {
    return c.json({ error: "columnId and index required" }, 400);
  }
  if (!moveCard(id, cardId, columnId, Math.max(0, Math.floor(index)))) {
    return c.json({ error: "Move failed" }, 400);
  }
  return c.json({ ok: true });
});

kanbanRoutes.delete("/:id/cards/:cardId", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const cardId = c.req.param("cardId");
  const user = c.get("user");
  if (!id || !cardId || !userCanAccessKanban(user.id, id) || !boardExists(id)) {
    return c.json({ error: "Board not found" }, 404);
  }
  if (!deleteCard(id, cardId)) return c.json({ error: "Card not found" }, 404);
  return c.json({ ok: true });
});
