import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import {
  getUserFromToken,
  requireAuth,
  requirePasswordOk,
  SESSION_COOKIE,
  signAssetFilename,
  verifyAssetSignature,
  type Variables,
} from "../auth";
import { env } from "../env";

export const assetRoutes = new Hono<{ Variables: Variables }>();

/** SVG excluded: served as image/svg+xml is a stored-XSS vector. */
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
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
    return c.json(
      {
        error:
          type === "image/svg+xml"
            ? "SVG uploads are not allowed"
            : "Unsupported file type",
      },
      400,
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > env.maxUploadBytes) {
    return c.json(
      {
        error: `File too large (max ${Math.floor(env.maxUploadBytes / (1024 * 1024))} MiB)`,
      },
      413,
    );
  }

  await mkdir(env.uploadsDir, { recursive: true });

  const ext = extname(file.name) || mimeToExt(type);
  // Never trust client extension for svg
  if (ext.toLowerCase() === ".svg") {
    return c.json({ error: "SVG uploads are not allowed" }, 400);
  }

  const id = crypto.randomUUID();
  const filename = `${id}${ext}`;
  const path = join(env.uploadsDir, filename);
  await Bun.write(path, buf);

  const sig = signAssetFilename(filename);
  return c.json({
    src: `/api/assets/${filename}?sig=${encodeURIComponent(sig)}`,
  });
});

assetRoutes.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return c.json({ error: "Invalid filename" }, 400);
  }
  if (filename.toLowerCase().endsWith(".svg")) {
    return c.json({ error: "Not found" }, 404);
  }

  const sig = c.req.query("sig");
  const hasValidSig = verifyAssetSignature(filename, sig);
  if (!hasValidSig) {
    const token = getCookie(c, SESSION_COOKIE);
    const user = getUserFromToken(token);
    if (!user || user.must_change_password) {
      return c.json({ error: "Unauthorized" }, 401);
    }
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
      "X-Content-Type-Options": "nosniff",
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
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    default:
      return "";
  }
}
