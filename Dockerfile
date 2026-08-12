# =============================================================================
# Nanocore — single container: API + WebSocket collab + built SPA
# Same origin on PORT (default 3001). No separate web process required.
# =============================================================================

# ---- build SPA ----
FROM oven/bun:1.2 AS build
WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run --filter web build \
  && test -f web/dist/index.html \
  && printf '%s\n' \
    '// Docker same-origin defaults (API+UI on one port)' \
    'window.__NANOCORE_CONFIG__ = { apiUrl: "", wsUrl: "" };' \
    > web/dist/config.js \
  && ls -la web/dist

# ---- runtime ----
# Install server deps *inside* /app/server so Bun always resolves hono/@tldraw/*
# from server/node_modules (no monorepo hoist / overwrite bugs).
FROM oven/bun:1.2-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist \
    COOKIE_SECURE=false \
    ALLOWED_ORIGINS=

# Server package + lockfile (lockfile optional but keeps versions stable when present)
COPY server/package.json ./server/package.json
COPY bun.lock* bun.lockb* ./
WORKDIR /app/server
# Install production deps into /app/server/node_modules
RUN bun install --production

# Server source (after install so we never wipe node_modules)
COPY server/src ./src
COPY server/tsconfig.json ./tsconfig.json

# SPA + entrypoint
WORKDIR /app
COPY --from=build /app/web/dist ./web/dist
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
# Strip Windows CRLF if present (checkout on Windows → "set: Illegal option -" in /bin/sh)
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh \
  && chmod +x /app/docker/entrypoint.sh \
  && head -n 5 /app/docker/entrypoint.sh \
  && test -f /app/web/dist/index.html \
  && test -f /app/web/dist/config.js \
  && test -d /app/server/node_modules/hono \
  && test -d /app/server/node_modules/@tldraw/sync-core \
  && cd /app/server \
  && bun -e "import 'hono'; import '@tldraw/sync-core'; console.log('runtime deps ok')"

VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
