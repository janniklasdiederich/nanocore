# Setup & Running

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (tested with 1.3)
- Optional: Docker for compose deploy

## Installation

```bash
bun install
cp .env.example .env   # optional for local defaults
```

## Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `PORT` | HTTP/WS port | No | `3001` |
| `HOST` | Bind address | No | `0.0.0.0` |
| `DATA_DIR` | SQLite + uploads directory | No | `./data` |
| `SESSION_SECRET` | Session token hashing salt | Prod yes | `dev-only-change-me` |
| `WEB_DIST` | Built SPA path (production serve) | No | `../web/dist` relative to server |
| `NODE_ENV` | Set `production` for secure cookies | No | — |
| `VITE_API_URL` | API origin baked into web build | No | same-origin `/api` |
| `VITE_WS_URL` | WebSocket origin override | No | from `VITE_API_URL` / defaults |
| `WEB_PORT` | `bun run start:web` listen port | No | `4173` |

## Running the Project

**Development** (two terminals):

```bash
bun run dev:server   # http://localhost:3001
bun run dev:web      # http://localhost:5173 (proxies /api + WS)
```

Open http://localhost:5173 — first visit runs setup.

**Production (single process):**

```bash
bun run build        # builds web/
PORT=3001 DATA_DIR=./data SESSION_SECRET=… bun run start
```

**Production (UI via Vite preview):**

```bash
bun run start                          # API :3001
VITE_API_URL=http://localhost:3001 bun run build:web
WEB_PORT=4173 bun run start:web        # UI :4173
```

**Docker:**

```bash
SESSION_SECRET=long-random docker compose up --build
```

## Common Issues

- **PowerShell `curl`**: use `curl.exe` or Bun fetch — `curl` is aliased to Invoke-WebRequest
- **WS auth**: session cookie must be present; use same-origin (Vite proxy) or same host in prod
- **Reset install**: delete `DATA_DIR` (e.g. `./data`) to re-run setup
- **Copy/paste over LAN HTTP**: browsers hide `navigator.clipboard` off HTTPS/localhost; `web/src/clipboardSecureFallback.ts` polyfills write via `execCommand`. Prefer `http://localhost:3001` or HTTPS if paste still misbehaves
