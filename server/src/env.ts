import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? "./data");
const isProd = process.env.NODE_ENV === "production";

const rawSecret = process.env.SESSION_SECRET ?? "dev-only-change-me";
const WEAK_SECRETS = new Set([
  "",
  "auto",
  "dev-only-change-me",
  "change-me-in-production",
  "change-me",
  "secret",
]);

if (isProd && WEAK_SECRETS.has(rawSecret)) {
  console.error(
    "[nanocore] FATAL: SESSION_SECRET is missing, 'auto', or a known default.\n" +
      "  Docker: omit SESSION_SECRET (entrypoint generates one) or set a long random value.\n" +
      "  Bare metal: export SESSION_SECRET=$(openssl rand -hex 32)",
  );
  process.exit(1);
}

/**
 * Secure cookies only over HTTPS.
 * - COOKIE_SECURE=true|false forces the flag
 * - default/auto: true only when PUBLIC_URL starts with https://
 * Docker plain HTTP must use false (compose default) or cookies never stick.
 */
function resolveCookieSecure(): boolean {
  const v = (process.env.COOKIE_SECURE ?? "auto").toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  const publicUrl = (process.env.PUBLIC_URL ?? "").trim();
  return publicUrl.startsWith("https://");
}

/** Comma-separated browser origins for cross-origin UI. Empty = same-origin only (Docker default). */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

/** Max upload size in bytes (default 15 MiB). */
const maxUploadBytes = Math.max(
  1024,
  Number(process.env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024) || 15 * 1024 * 1024,
);

const webDist = process.env.WEB_DIST
  ? resolve(process.env.WEB_DIST)
  : resolve(import.meta.dir, "../../web/dist");

if (isProd && process.env.WEB_DIST && !existsSync(webDist)) {
  console.error(
    `[nanocore] FATAL: WEB_DIST is set but not found: ${webDist}\n` +
      "  The Docker image should include web/dist. Rebuild with: docker compose build --no-cache",
  );
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir,
  dbPath: resolve(dataDir, "nanocore.db"),
  uploadsDir: resolve(dataDir, "uploads"),
  sessionSecret: rawSecret,
  isProd,
  cookieSecure: resolveCookieSecure(),
  allowedOrigins,
  maxUploadBytes,
  /** Built SPA directory (production Docker / `bun run build`). */
  webDist,
  publicUrl: (process.env.PUBLIC_URL ?? "").replace(/\/$/, ""),
};
