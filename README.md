# Nanocore

Open-source collaborative whiteboard built on [tldraw](https://tldraw.dev).  
Single-tenant, self-hosted: one install = one organization, one SQLite file.

## Features (v0.1)

- First-run setup: organization name + admin account
- Admin-created users + invite links
- Forced password change on first login
- Shared infinite canvases with live cursors (tldraw)
- WebSocket collaboration (no Cloudflare required)
- Admin-only board create / rename / delete

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **API + sync:** [Hono](https://hono.dev) + `@tldraw/sync-core`
- **UI:** React + Vite + [tldraw](https://tldraw.dev)
- **DB:** SQLite (single file under `DATA_DIR`)

---

## Easiest production: Docker (recommended)

**One container serves the web UI, REST API, and WebSockets on the same port.**  
No separate frontend process, no CORS allowlist required.

```bash
# from the repo root
docker compose up --build
```

Open **http://localhost:3001** and complete first-run setup.

| What | Where |
|---|---|
| UI + API + WS | `http://localhost:3001` |
| SQLite + uploads | Docker volume `nanocore-data` |
| Session secret | Auto-generated into the volume if `SESSION_SECRET` is unset/`auto` |
| Backup | `sh docker/backup.sh` → `../backups/YYYY-MM-DD` (stops briefly, then restarts) |

### Optional `.env` (repo root)

```bash
cp .env.example .env
# edit SESSION_SECRET / COOKIE_SECURE if you want
docker compose up --build
```

| Variable | Default (Docker) | Notes |
|---|---|---|
| `SESSION_SECRET` | `auto` | Generated & stored in `/data/.session_secret` |
| `COOKIE_SECURE` | `false` | Set `true` only if browsers use **HTTPS** |
| `ALLOWED_ORIGINS` | _(empty)_ | Only if the SPA is on another origin |
| `PORT` | `3001` | Host port mapping |
| `GIPHY_API_KEY` | _(empty)_ | Board GIF picker; get a key at [developers.giphy.com](https://developers.giphy.com/) |

### Behind an HTTPS reverse proxy

Terminate TLS at nginx/Caddy/Traefik, proxy to the container on `3001`, then:

```env
COOKIE_SECURE=true
# PUBLIC_URL=https://boards.example.com   # optional
# ALLOWED_ORIGINS=                        # still empty if UI is same host
```

### Split UI origin (unusual)

If the SPA is hosted elsewhere (not recommended for Docker):

```env
ALLOWED_ORIGINS=https://app.example.com
# and point the SPA's VITE_API_URL / config.js at the API origin
```

---

## Local development

```bash
bun install
cp .env.example .env
bun run dev:server   # http://localhost:3001
bun run dev:web      # http://localhost:5173  (proxies /api → :3001)
```

For Vite-on-another-origin, leave `ALLOWED_ORIGINS` empty in **development** (dev CORS reflects any origin).

---

## Bare-metal production (no Docker)

```bash
bun install
bun run build                 # builds web → web/dist
export NODE_ENV=production
export SESSION_SECRET=$(openssl rand -hex 32)
export COOKIE_SECURE=false    # true if you serve HTTPS
export DATA_DIR=./data
bun run start                 # serves API + web/dist on :3001
```

### Split UI + API (optional)

```bash
# .env
VITE_API_URL=http://YOUR_IP:3001
VITE_WS_URL=ws://YOUR_IP:3001
ALLOWED_ORIGINS=http://YOUR_IP:4173
COOKIE_SECURE=false

bun run start                 # API :3001
bun run build:web && bun run start:web   # UI :4173 (writes dist/config.js)
```

---

## License

MIT (application code). tldraw has its own SDK license — review [tldraw licensing](https://tldraw.dev) for production use.
