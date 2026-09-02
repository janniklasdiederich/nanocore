import { Hono } from "hono";
import {
  createSyncToken,
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import { db } from "../db";
import {
  documentIdsInSpace,
  listDocumentsInSpace,
  listSpaceAccess,
  listSpacesForUser,
  mapDocument,
  mapSpace,
  setSpaceAccess,
  userCanAccessDocument,
  userCanAccessSpace,
  type DocSpaceRow,
  type DocumentRow,
} from "../docAccess";
import { closeDocRoom, closeDocsInSpace } from "../docRooms";
import { kickUsersFromBoard } from "../wsConnections";

export const spaceRoutes = new Hono<{ Variables: Variables }>();
export const docRoutes = new Hono<{ Variables: Variables }>();

spaceRoutes.use("*", requireAuth);
docRoutes.use("*", requireAuth);

function spaceExists(id: string): DocSpaceRow | null {
  return db.query("SELECT * FROM doc_spaces WHERE id = ?").get(id) as
    | DocSpaceRow
    | null;
}

function documentExists(id: string): DocumentRow | null {
  return db
    .query(
      `SELECT id, space_id, title, created_by, created_at, updated_at
       FROM documents WHERE id = ?`,
    )
    .get(id) as DocumentRow | null;
}

function cleanTitle(
  raw: unknown,
  fallback: string,
  max: number,
): string | null {
  const s = typeof raw === "string" ? raw.trim() : fallback;
  if (!s || s.length > max) return null;
  return s;
}

function kickUsersFromSpace(spaceId: string, userIds: string[]): void {
  for (const docId of documentIdsInSpace(spaceId)) {
    kickUsersFromBoard(`doc:${docId}`, userIds);
  }
}

spaceRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const user = c.get("user");
  const rows = listSpacesForUser(user.id, user.role);
  return c.json({ spaces: rows.map(mapSpace) });
});

spaceRoutes.post("/", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const body = await c.req.json().catch(() => null);
  const name = cleanTitle(body?.name, "Untitled space", 120);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  const user = c.get("user");
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO doc_spaces (id, name, created_by) VALUES (?, ?, ?)`,
  ).run(id, name, user.id);
  const row = spaceExists(id)!;
  return c.json({ space: mapSpace({ ...row, document_count: 0 }) }, 201);
});

spaceRoutes.get("/:id/members", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !spaceExists(id)) return c.json({ error: "Space not found" }, 404);
  return c.json(listSpaceAccess(id));
});

spaceRoutes.put("/:id/members", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !spaceExists(id)) return c.json({ error: "Space not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  if (!userIds) return c.json({ error: "userIds array required" }, 400);
  const groupIds = Array.isArray(body?.groupIds)
    ? body.groupIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  const granter = c.get("user");
  const { removedUserIds } = setSpaceAccess(id, userIds, groupIds, granter.id);
  kickUsersFromSpace(id, removedUserIds);
  return c.json(listSpaceAccess(id));
});

spaceRoutes.post("/:id/docs", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  if (!id || !spaceExists(id) || !userCanAccessSpace(user.id, id)) {
    return c.json({ error: "Space not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const title = cleanTitle(body?.title, "Untitled document", 200);
  if (!title) return c.json({ error: "Invalid title" }, 400);
  const docId = crypto.randomUUID();
  db.query(
    `INSERT INTO documents (id, space_id, title, created_by) VALUES (?, ?, ?, ?)`,
  ).run(docId, id, title, user.id);
  db.query(
    `UPDATE doc_spaces SET updated_at = datetime('now') WHERE id = ?`,
  ).run(id);
  const row = documentExists(docId)!;
  return c.json({ document: mapDocument(row) }, 201);
});

spaceRoutes.get("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Space id required" }, 400);
  const user = c.get("user");
  const space = spaceExists(id);
  if (!space || !userCanAccessSpace(user.id, id)) {
    return c.json({ error: "Space not found" }, 404);
  }
  const documents = listDocumentsInSpace(id);
  return c.json({
    space: mapSpace({ ...space, document_count: documents.length }),
    documents: documents.map(mapDocument),
  });
});

spaceRoutes.patch("/:id", requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const existing = id ? spaceExists(id) : null;
  if (!existing) return c.json({ error: "Space not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const name = cleanTitle(body?.name, existing.name, 120);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  db.query(
    `UPDATE doc_spaces SET name = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(name, existing.id);
  const row = spaceExists(existing.id)!;
  const count = (
    db
      .query(`SELECT COUNT(*) AS n FROM documents WHERE space_id = ?`)
      .get(existing.id) as { n: number }
  ).n;
  return c.json({ space: mapSpace({ ...row, document_count: count }) });
});

spaceRoutes.delete("/:id", requireAdmin, (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !spaceExists(id)) return c.json({ error: "Space not found" }, 404);
  closeDocsInSpace(id);
  db.query("DELETE FROM doc_spaces WHERE id = ?").run(id);
  return c.json({ ok: true });
});

docRoutes.get("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Document id required" }, 400);
  const user = c.get("user");
  const doc = documentExists(id);
  if (!doc || !userCanAccessDocument(user.id, id)) {
    return c.json({ error: "Document not found" }, 404);
  }
  const space = spaceExists(doc.space_id);
  if (!space) return c.json({ error: "Document not found" }, 404);
  return c.json({
    document: mapDocument(doc),
    space: { id: space.id, name: space.name },
  });
});

docRoutes.post("/:id/sync-token", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Document id required" }, 400);
  const user = c.get("user");
  if (!userCanAccessDocument(user.id, id)) {
    return c.json({ error: "Document not found" }, 404);
  }
  return c.json({
    token: createSyncToken(user.id, id),
    expiresInSec: 120,
  });
});

docRoutes.patch("/:id", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  const existing = id ? documentExists(id) : null;
  if (!existing || !userCanAccessDocument(user.id, existing.id)) {
    return c.json({ error: "Document not found" }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const title = cleanTitle(body?.title, existing.title, 200);
  if (!title) return c.json({ error: "Invalid title" }, 400);
  db.query(
    `UPDATE documents SET title = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(title, existing.id);
  db.query(
    `UPDATE doc_spaces SET updated_at = datetime('now') WHERE id = ?`,
  ).run(existing.space_id);
  const row = documentExists(existing.id)!;
  return c.json({ document: mapDocument(row) });
});

docRoutes.delete("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  const user = c.get("user");
  const existing = id ? documentExists(id) : null;
  if (!existing || !userCanAccessDocument(user.id, existing.id)) {
    return c.json({ error: "Document not found" }, 404);
  }
  closeDocRoom(existing.id);
  db.query("DELETE FROM documents WHERE id = ?").run(existing.id);
  db.query(
    `UPDATE doc_spaces SET updated_at = datetime('now') WHERE id = ?`,
  ).run(existing.space_id);
  return c.json({ ok: true });
});
