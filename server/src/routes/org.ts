import { Hono } from "hono";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  requireAdmin,
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import { db, getOrg, publicOrg } from "../db";
import { env } from "../env";

export const orgRoutes = new Hono<{ Variables: Variables }>();

const LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function mimeToExt(type: string): string {
  switch (type) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

/** Public: used as favicon + logo on login. */
orgRoutes.get("/logo", async (c) => {
  const org = getOrg();
  const filename = org?.logo_filename;
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return c.body(null, 404);
  }
  const path = join(env.uploadsDir, filename);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return c.body(null, 404);
  }
  return new Response(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

orgRoutes.post("/logo", requireAuth, requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const org = getOrg();
  if (!org) return c.json({ error: "Not set up" }, 400);

  const form = await c.req.parseBody();
  const file = form.file;
  if (!file || typeof file === "string") {
    return c.json({ error: "file is required" }, 400);
  }

  const type = file.type || "";
  if (!LOGO_TYPES.has(type)) {
    return c.json({ error: "Use a PNG, JPEG, GIF, or WebP image" }, 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const max = Math.min(env.maxUploadBytes, 2 * 1024 * 1024);
  if (buf.byteLength > max) {
    return c.json({ error: "Image too large (max 2 MiB)" }, 413);
  }

  const ext = extname(file.name) || mimeToExt(type);
  if (!ext || ext.toLowerCase() === ".svg") {
    return c.json({ error: "Unsupported file type" }, 400);
  }

  const filename = `org-logo-${crypto.randomUUID()}${ext}`;
  await Bun.write(join(env.uploadsDir, filename), buf);

  const prev = org.logo_filename;
  db.query(`UPDATE org SET logo_filename = ? WHERE id = 1`).run(filename);
  if (prev && prev !== filename) {
    await unlink(join(env.uploadsDir, prev)).catch(() => {});
  }

  return c.json({ org: publicOrg(getOrg()) });
});

orgRoutes.delete("/logo", requireAuth, requireAdmin, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const org = getOrg();
  if (!org) return c.json({ error: "Not set up" }, 400);

  const prev = org.logo_filename;
  db.query(`UPDATE org SET logo_filename = NULL WHERE id = 1`).run();
  if (prev) {
    await unlink(join(env.uploadsDir, prev)).catch(() => {});
  }

  return c.json({ org: publicOrg(getOrg()) });
});
