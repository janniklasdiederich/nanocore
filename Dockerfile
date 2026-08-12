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
# Build web; public/config.js is copied into dist by Vite
RUN bun run --filter web build \
  && test -f web/dist/index.html \
  && printf '%s\n' \
    '// Docker same-origin defaults (API+UI on one port)' \
    'window.__NANOCORE_CONFIG__ = { apiUrl: "", wsUrl: "" };' \
    > web/dist/config.js \
  && ls -la web/dist

# ---- runtime ----
FROM oven/bun:1.2-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist \
    # HTTP by default in Docker; set COOKIE_SECURE=true behind HTTPS reverse proxy
    COOKIE_SECURE=false \
    # Empty = same-origin only (correct for this image). Set only if UI is on another origin.
    ALLOWED_ORIGINS=

# Production deps for the server workspace only (smaller image)
COPY package.json bun.lock* bun.lockb* ./
COPY server/package.json ./server/
# Workspace root expects a web package; keep a stub so bun install succeeds
RUN mkdir -p web \
  && printf '%s\n' '{"name":"web","private":true,"version":"0.0.0"}' > web/package.json \
  && bun install --production --filter server \
  || bun install --production

COPY server ./server
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
COPY --from=build /app/web/dist ./web/dist

RUN chmod +x /app/docker/entrypoint.sh \
  && test -f /app/web/dist/index.html \
  && test -f /app/web/dist/config.js

VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
