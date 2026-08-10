import { Hono } from "hono";
import {
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import { db, type BoardRow } from "../db";

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

boardRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const rows = db
    .query(`SELECT * FROM boards ORDER BY updated_at DESC`)
    .all() as BoardRow[];

  return c.json({ boards: rows.map(mapBoard) });
});

boardRoutes.post("/", async (c) => {
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

boardRoutes.get("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const row = db
    .query("SELECT * FROM boards WHERE id = ?")
    .get(c.req.param("id")) as BoardRow | null;

  if (!row) return c.json({ error: "Board not found" }, 404);
  return c.json({ board: mapBoard(row) });
});

boardRoutes.patch("/:id", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
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

boardRoutes.delete("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const id = c.req.param("id");
  const existing = db.query("SELECT id FROM boards WHERE id = ?").get(id);
  if (!existing) return c.json({ error: "Board not found" }, 404);

  db.query("DELETE FROM boards WHERE id = ?").run(id);
  return c.json({ ok: true });
});
