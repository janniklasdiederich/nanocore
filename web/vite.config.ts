import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
/** Monorepo root — where users keep `.env` */
const monorepoRoot = resolve(webRoot, "..");

export default defineConfig(({ mode }) => {
  // Load root .env then web/.env (web wins on conflicts)
  const env = {
    ...loadEnv(mode, monorepoRoot, ""),
    ...loadEnv(mode, webRoot, ""),
  };

  const apiTarget =
    env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
  const webPort = Number(env.WEB_PORT || 4173);
  const devPort = Number(env.WEB_DEV_PORT || 5173);

  return {
    // So `import.meta.env.VITE_*` picks up monorepo root `.env` on build
    envDir: monorepoRoot,
    plugins: [react()],
    server: {
      port: devPort,
      host: env.WEB_HOST || true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: webPort,
      host: env.WEB_HOST || "0.0.0.0",
      // HTTP proxy only — WebSockets must hit the API origin (see config.ts)
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
