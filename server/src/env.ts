import { resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? "./data");

export const env = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir,
  dbPath: resolve(dataDir, "nanocore.db"),
  uploadsDir: resolve(dataDir, "uploads"),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-change-me",
  isProd: process.env.NODE_ENV === "production",
  /** When set, serve the built SPA from this directory (production). */
  webDist: process.env.WEB_DIST
    ? resolve(process.env.WEB_DIST)
    : resolve(import.meta.dir, "../../web/dist"),
};
