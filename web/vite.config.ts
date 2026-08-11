import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer explicit API URL; fall back to local server for dev/preview proxy
  const apiTarget =
    env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
  const webPort = Number(env.WEB_PORT || env.PORT || 4173);
  const devPort = Number(env.WEB_PORT || env.PORT || 5173);

  return {
    plugins: [react()],
    server: {
      port: devPort,
      host: env.WEB_HOST || true,
      proxy: {
        // When VITE_API_URL is empty, browser uses relative /api → proxy
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: webPort,
      host: env.WEB_HOST || "0.0.0.0",
      // Same proxy for `vite preview` when using relative /api (no VITE_API_URL baked in)
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
