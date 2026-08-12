import { resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? "./data");
const isProd = process.env.NODE_ENV === "production";

const rawSecret = process.env.SESSION_SECRET ?? "dev-only-change-me";
const WEAK_SECRETS = new Set([
  "",
  "dev-only-change-me",
  "change-me-in-production",
  "change-me",
  "secret",
]);

if (isProd && WEAK_SECRETS.has(rawSecret)) {
  console.error(
    "[nanocore] FATAL: SESSION_SECRET is missing or uses a known default. " +
      "Set a strong SESSION_SECRET before running in production.",
  );
  process.exit(1);
}

/** Comma-separated browser origins allowed for CORS (credentials). Empty = allow any in dev only. */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Max upload size in bytes (default 15 MiB). */
const maxUploadBytes = Math.max(
  1024,
  Number(process.env.MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024) || 15 * 1024 * 1024,
);

export const env = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir,
  dbPath: resolve(dataDir, "nanocore.db"),
  uploadsDir: resolve(dataDir, "uploads"),
  sessionSecret: rawSecret,
  isProd,
  allowedOrigins,
  maxUploadBytes,
  /** When set, serve the built SPA from this directory (production). */
  webDist: process.env.WEB_DIST
    ? resolve(process.env.WEB_DIST)
    : resolve(import.meta.dir, "../../web/dist"),
};
