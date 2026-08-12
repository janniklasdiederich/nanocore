# Architecture

## Structure

```
nanocore/
  server/          # Bun + Hono API, WebSocket sync, SQLite, static UI in prod
  web/             # React + Vite SPA (dev: proxy /api → :3001)
  data/            # Runtime: nanocore.db + uploads/ (gitignored)
  Dockerfile
  docker-compose.yml
```

## Key Components

- `server/src/index.ts` — Bun.serve: HTTP via Hono + WS upgrade at `/api/sync/:boardId`
- `server/src/db.ts` — bun:sqlite schema (org, users, sessions, boards, board_snapshots)
- `server/src/auth.ts` — bcrypt passwords, session cookies, requireAuth / requireAdmin
- `server/src/rooms.ts` — one `TLSocketRoom` per active board; debounced snapshot persist
- `server/src/routes/*` — setup, auth, users, boards, assets
- `web/src/pages/*` — Setup, Login, ChangePassword, Boards, Board (tldraw), Users
- `web/src/pages/BoardPage.tsx` — `useSync` + asset upload to `/api/assets/upload`

## Data Flow

1. Browser hits SPA (Vite dev or server-served `web/dist`)
2. REST under `/api/*` with `credentials: include` session cookie
3. Board open → WebSocket `/api/sync/:boardId?sessionId=…` (cookie auth on upgrade)
4. `TLSocketRoom` broadcasts changes; `onDataChange` saves RoomSnapshot JSON to SQLite

## Key Decisions

- **Single process (Bun)** over Next.js: long-lived WebSockets + SQLite self-host simplicity
- **tldraw v3.x sync** with snapshot persistence (not Cloudflare / not SQLiteSyncStorage — that API is newer than pinned 3.15)
- **Admin-provisioned users** only; temp password + `must_change_password`
- **Single-tenant org** row (`id = 1`) for whitelabel display name
- **Board mutations admin-only** (create/rename/delete); all members can list/open/collab
- **Asset access** via HMAC `sig` query (works in `<img>`) or session cookie; SVG uploads blocked
- **Production** requires non-default `SESSION_SECRET`; optional `ALLOWED_ORIGINS` for split UI/API

## Dependencies

- tldraw / @tldraw/sync / @tldraw/sync-core
- hono
- bun (runtime + bun:sqlite + Bun.password)
- react, react-router-dom, vite
