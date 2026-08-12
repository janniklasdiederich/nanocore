#!/bin/sh
# Docker entrypoint: data dir, session secret, SPA check, then server.
# Uses POSIX sh (available in oven/bun slim images).
set -eu

DATA_DIR="${DATA_DIR:-/data}"
WEB_DIST="${WEB_DIST:-/app/web/dist}"
SECRET_FILE="${DATA_DIR}/.session_secret"
PORT_NUM="${PORT:-3001}"

mkdir -p "$DATA_DIR" "${DATA_DIR}/uploads"

# --- Session secret ---
# Prefer explicit SESSION_SECRET. If unset or "auto", load/generate into the volume
# so restarts keep cookies valid without editing compose files.
if [ -z "${SESSION_SECRET:-}" ] || [ "${SESSION_SECRET}" = "auto" ]; then
  if [ -f "$SECRET_FILE" ] && [ -s "$SECRET_FILE" ]; then
    SESSION_SECRET=$(tr -d '[:space:]' <"$SECRET_FILE")
    export SESSION_SECRET
    echo "[nanocore] Loaded SESSION_SECRET from ${SECRET_FILE}"
  else
    if command -v openssl >/dev/null 2>&1; then
      SESSION_SECRET=$(openssl rand -hex 32)
    else
      SESSION_SECRET=$(bun -e 'const a=new Uint8Array(32);crypto.getRandomValues(a);console.log(Array.from(a,b=>b.toString(16).padStart(2,"0")).join(""))')
    fi
    export SESSION_SECRET
    printf '%s\n' "$SESSION_SECRET" >"$SECRET_FILE"
    chmod 600 "$SECRET_FILE" 2>/dev/null || true
    echo "[nanocore] Generated SESSION_SECRET and saved to ${SECRET_FILE}"
  fi
fi

# --- SPA must exist (built into the image) ---
if [ ! -d "$WEB_DIST" ] || [ ! -f "$WEB_DIST/index.html" ]; then
  echo "[nanocore] FATAL: Web UI not found at ${WEB_DIST}"
  echo "  Rebuild the image so the web build stage copies dist into the runtime image."
  exit 1
fi

# Same-origin config.js if missing (UI + API on one port)
if [ ! -f "$WEB_DIST/config.js" ]; then
  printf '%s\n' \
    '// Docker default: same-origin API + WebSocket' \
    'window.__NANOCORE_CONFIG__ = { apiUrl: "", wsUrl: "" };' \
    >"$WEB_DIST/config.js"
  echo "[nanocore] Wrote same-origin ${WEB_DIST}/config.js"
fi

echo "[nanocore] Starting (WEB_DIST=${WEB_DIST}, DATA_DIR=${DATA_DIR}, PORT=${PORT_NUM})"
exec bun run /app/server/src/index.ts
