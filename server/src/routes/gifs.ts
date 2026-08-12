import { Hono } from "hono";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  requireAuth,
  requirePasswordOk,
  signAssetFilename,
  type Variables,
} from "../auth";
import { env } from "../env";
import { clientIp, rateLimit } from "../rateLimit";

export const gifRoutes = new Hono<{ Variables: Variables }>();

gifRoutes.use("*", requireAuth);

const GIPHY = "https://api.giphy.com/v1/gifs";
const PAGE_SIZE = 24;

type GiphyImage = {
  url?: string;
  width?: string;
  height?: string;
  size?: string;
};

type GiphyGif = {
  id: string;
  title?: string;
  images?: {
    original?: GiphyImage;
    downsized?: GiphyImage;
    preview_gif?: GiphyImage;
    fixed_width?: GiphyImage;
  };
};

type GiphyListResponse = {
  data?: GiphyGif[];
};

type GiphyOneResponse = {
  data?: GiphyGif;
};

function noKey() {
  return {
    error: "GIF search is not configured. Set GIPHY_API_KEY on the server.",
    code: "GIPHY_NOT_CONFIGURED",
  };
}

gifRoutes.get("/", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  if (!env.giphyApiKey) {
    return c.json({ ...noKey(), configured: false, gifs: [] }, 503);
  }

  const ip = clientIp(c.req);
  if (!rateLimit(`gifs:search:${ip}`, 40, 60_000)) {
    return c.json({ error: "Too many GIF searches" }, 429);
  }

  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);

  const params = new URLSearchParams({
    api_key: env.giphyApiKey,
    limit: String(PAGE_SIZE),
    offset: String(offset),
    rating: "pg",
    lang: "en",
  });

  const url = q
    ? `${GIPHY}/search?${params}&q=${encodeURIComponent(q)}`
    : `${GIPHY}/trending?${params}`;

  const res = await fetch(url);
  if (!res.ok) {
    return c.json({ error: "GIF provider failed" }, 502);
  }

  const body = (await res.json()) as GiphyListResponse;
  const gifs = (body.data ?? []).map(mapGif).filter((g) => g.previewUrl);

  return c.json({ configured: true, gifs, offset, limit: PAGE_SIZE });
});

gifRoutes.post("/import", async (c) => {
  const blocked = requirePasswordOk(c);
  if (blocked) return blocked;

  if (!env.giphyApiKey) {
    return c.json(noKey(), 503);
  }

  const ip = clientIp(c.req);
  if (!rateLimit(`gifs:import:${ip}`, 20, 60_000)) {
    return c.json({ error: "Too many GIF imports" }, 429);
  }

  const body = (await c.req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!/^[a-zA-Z0-9]+$/.test(id) || id.length > 32) {
    return c.json({ error: "Invalid GIF id" }, 400);
  }

  const metaRes = await fetch(
    `${GIPHY}/${encodeURIComponent(id)}?api_key=${encodeURIComponent(env.giphyApiKey)}`,
  );
  if (!metaRes.ok) {
    return c.json({ error: "GIF not found" }, 404);
  }

  const meta = (await metaRes.json()) as GiphyOneResponse;
  const gif = meta.data;
  if (!gif?.id) {
    return c.json({ error: "GIF not found" }, 404);
  }

  const media = pickDownload(gif);
  if (!media) {
    return c.json({ error: "No downloadable GIF" }, 422);
  }

  if (!isAllowedGiphyUrl(media.url)) {
    return c.json({ error: "Blocked media host" }, 400);
  }

  const fileRes = await fetch(media.url, {
    headers: { Accept: "image/gif,image/webp,image/*" },
    redirect: "follow",
  });
  if (!fileRes.ok) {
    return c.json({ error: "Failed to download GIF" }, 502);
  }

  const buf = Buffer.from(await fileRes.arrayBuffer());
  if (buf.byteLength > env.maxUploadBytes) {
    return c.json(
      {
        error: `GIF too large (max ${Math.floor(env.maxUploadBytes / (1024 * 1024))} MiB)`,
      },
      413,
    );
  }

  const type = sniffImageType(fileRes.headers.get("content-type"), buf);
  if (!type) {
    return c.json({ error: "Not a GIF or animated image" }, 415);
  }

  await mkdir(env.uploadsDir, { recursive: true });
  const filename = `${crypto.randomUUID()}${type.ext}`;
  await Bun.write(join(env.uploadsDir, filename), buf);
  const sig = signAssetFilename(filename);

  return c.json({
    src: `/api/assets/${filename}?sig=${encodeURIComponent(sig)}`,
    w: media.w,
    h: media.h,
    mimeType: type.mime,
    name: (gif.title || "gif").slice(0, 80),
  });
});

function mapGif(gif: GiphyGif) {
  const preview =
    gif.images?.fixed_width?.url ||
    gif.images?.preview_gif?.url ||
    gif.images?.downsized?.url ||
    "";
  const w = Number(gif.images?.fixed_width?.width || gif.images?.original?.width || 200);
  const h = Number(gif.images?.fixed_width?.height || gif.images?.original?.height || 200);
  return {
    id: gif.id,
    title: gif.title || "GIF",
    previewUrl: preview,
    w: Number.isFinite(w) && w > 0 ? w : 200,
    h: Number.isFinite(h) && h > 0 ? h : 200,
  };
}

function pickDownload(gif: GiphyGif): { url: string; w: number; h: number } | null {
  const images = gif.images;
  if (!images) return null;
  const candidates = [images.downsized, images.original, images.fixed_width];
  for (const img of candidates) {
    if (!img?.url) continue;
    const w = Number(img.width || 320);
    const h = Number(img.height || 240);
    return {
      url: img.url,
      w: Number.isFinite(w) && w > 0 ? w : 320,
      h: Number.isFinite(h) && h > 0 ? h : 240,
    };
  }
  return null;
}

function isAllowedGiphyUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === "giphy.com" || host.endsWith(".giphy.com");
  } catch {
    return false;
  }
}

function sniffImageType(
  header: string | null,
  buf: Buffer,
): { mime: string; ext: string } | null {
  const declared = (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (buf.length >= 6 && buf.subarray(0, 6).toString("ascii").startsWith("GIF8")) {
    return { mime: "image/gif", ext: ".gif" };
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: ".webp" };
  }
  if (declared === "image/gif") return { mime: "image/gif", ext: ".gif" };
  if (declared === "image/webp") return { mime: "image/webp", ext: ".webp" };
  return null;
}
