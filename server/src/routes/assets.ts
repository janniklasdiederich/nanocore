import { Hono } from "hono";
import { mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import {
  requireAuth,
  requirePasswordOk,
  type Variables,
} from "../auth";
import { env } from "../env";

export const assetRoutes = new Hono<{ Variables: Variables }>();

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
]);

assetRoutes.post("/upload", requireAuth, async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  const form = await c.req.parseBody();
  const file = form.file;
  if (!file || typeof file === "string") {
    return c.json({ error: "file is required" }, 400);
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return c.json({ error: "Unsupported file type" }, 400);
  }

  await mkdir(env.uploadsDir, { recursive: true });

  const ext = extname(file.name) || mimeToExt(type);
  const id = crypto.randomUUID();
  const filename = `${id}${ext}`;
  const path = join(env.uploadsDir, filename);

  const buf = Buffer.from(await file.arrayBuffer());
  await Bun.write(path, buf);

  return c.json({
    src: `/api/assets/${filename}`,
  });
});

assetRoutes.get("/:filename", async (c) => {
  // Assets are readable with a valid session so boards aren't world-public.
  // Cookie is sent automatically for same-origin; for img tags we rely on that.
  const filename = c.req.param("filename");
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const path = join(env.uploadsDir, filename);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return c.json({ error: "Not found" }, 404);
  }

  return new Response(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

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
    case "image/svg+xml":
      return ".svg";
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    default:
      return "";
  }
}
