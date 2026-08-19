import { Hono } from "hono";
import {
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import {
  createGroup,
  deleteGroup,
  getGroup,
  listGroupMembers,
  listGroups,
  renameGroup,
  setGroupMembers,
} from "../groups";

export const groupRoutes = new Hono<{ Variables: Variables }>();

groupRoutes.use("*", requireAuth);
groupRoutes.use("*", requireAdmin);

function cleanName(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > 80) return null;
  return s;
}

groupRoutes.get("/", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  return c.json({ groups: listGroups() });
});

groupRoutes.post("/", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const body = await c.req.json().catch(() => null);
  const name = cleanName(body?.name);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  const user = c.get("user");
  return c.json({ group: createGroup(name, user.id) }, 201);
});

groupRoutes.get("/:id/members", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !getGroup(id)) return c.json({ error: "Group not found" }, 404);
  return c.json({ users: listGroupMembers(id) });
});

groupRoutes.put("/:id/members", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !getGroup(id)) return c.json({ error: "Group not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
    : null;
  if (!userIds) return c.json({ error: "userIds array required" }, 400);
  setGroupMembers(id, userIds);
  return c.json({ users: listGroupMembers(id) });
});

groupRoutes.patch("/:id", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !getGroup(id)) return c.json({ error: "Group not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const name = cleanName(body?.name);
  if (!name) return c.json({ error: "Invalid name" }, 400);
  const group = renameGroup(id, name);
  if (!group) return c.json({ error: "Group not found" }, 404);
  return c.json({ group });
});

groupRoutes.delete("/:id", (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;
  const id = c.req.param("id");
  if (!id || !deleteGroup(id)) return c.json({ error: "Group not found" }, 404);
  return c.json({ ok: true });
});
