# Nanocore

Open-source collaborative whiteboard built on [tldraw](https://tldraw.dev).  
Single-tenant, self-hosted: one install = one organization, one SQLite file.

## Features (v0.1)

- First-run setup: organization name + admin account
- Admin-created users (email + temporary password)
- Forced password change on first login
- Shared infinite canvases with live cursors (tldraw defaults + images)
- WebSocket collaboration (no Cloudflare required)

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **API + sync:** [Hono](https://hono.dev) + `@tldraw/sync-core`
- **UI:** React + Vite + [tldraw](https://tldraw.dev)
- **DB:** SQLite (single file under `DATA_DIR`)

## Quick start (dev)

```bash
bun install
cp .env.example .env
bun run dev:server   # http://localhost:3001
bun run dev:web      # http://localhost:5173
```

Open the web URL. On first visit you’ll complete setup (org name + admin).

## Production (single process)

Build the web UI, then run the server (it serves the built UI and API/WebSocket):

```bash
bun install
bun run build
PORT=3001 DATA_DIR=./data bun run start
```

## Production (split UI + API)

API on one port, Vite preview for the UI on another. **WebSockets must hit the API port** (not the UI port).

```bash
# 1) Root .env (example)
# VITE_API_URL=http://YOUR_IP:3001
# VITE_WS_URL=ws://YOUR_IP:3001
# WEB_PORT=4173

# 2) API
bun run start

# 3) Build once, then start UI (start:web writes dist/config.js from .env)
bun run build:web
bun run start:web
```

Open `http://YOUR_IP:4173`. Boards connect to `ws://YOUR_IP:3001/api/sync/...`.

If the browser still tries `ws://…:4173/api/sync`, restart `start:web` so `config.js` is regenerated, then hard-refresh.

| Variable | Used for |
|---|---|
| `VITE_API_URL` | Client → API base (runtime `config.js` + build) |
| `VITE_WS_URL` | Board WebSocket origin (defaults from API URL) |
| `WEB_PORT` | Port for `start:web` (default 4173) |


## Docker (optional)

```bash
docker compose up --build
```

Data persists in the `nanocore-data` volume (SQLite + uploaded assets).

## License

MIT (application code). tldraw has its own SDK license — review [tldraw licensing](https://tldraw.dev) for production use.
