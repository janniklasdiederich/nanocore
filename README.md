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

Run the API and a static Vite preview for the client. Set `VITE_API_URL` **when building** the client so API/WebSocket calls hit the server:

```bash
# terminal 1 — API
PORT=3001 DATA_DIR=./data SESSION_SECRET=… bun run start

# build client with API origin baked in, then serve
VITE_API_URL=http://localhost:3001 bun run build:web
WEB_PORT=4173 bun run start:web
```

Open `http://localhost:4173`.  
`start:web` is `vite preview` and also proxies `/api` to `VITE_API_URL` (or `http://localhost:3001`) if you built **without** `VITE_API_URL` and rely on relative paths.

| Variable | Used for |
|---|---|
| `VITE_API_URL` | Client → API base URL (build-time) |
| `VITE_WS_URL` | Optional board WebSocket origin |
| `WEB_PORT` | Port for `start:web` (default 4173) |


## Docker (optional)

```bash
docker compose up --build
```

Data persists in the `nanocore-data` volume (SQLite + uploaded assets).

## License

MIT (application code). tldraw has its own SDK license — review [tldraw licensing](https://tldraw.dev) for production use.
