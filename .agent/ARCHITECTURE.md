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

- `server/src/index.ts` — Bun.serve: HTTP via Hono + WS upgrade at `/api/sync/:boardId`, `/api/kanban-sync/:boardId`, `/api/doc-sync/:docId`
- `server/src/db.ts` — bun:sqlite schema (org, users, sessions, boards, board_snapshots, groups, kanban_*, doc_spaces, documents)
- `server/src/auth.ts` — bcrypt passwords, session cookies, requireAuth / requireAdmin
- `server/src/rooms.ts` — one `TLSocketRoom` per active board; debounced snapshot persist
- `server/src/routes/*` — setup, auth, users, boards, assets, kanban, docs/spaces
- `web/src/pages/*` — Setup, Login, ChangePassword, Boards, Board (tldraw), Users, Kanban, Spaces, Doc editor
- `web/src/pages/BoardPage.tsx` — `useSync` + asset upload to `/api/assets/upload`; stamps shape owner on local create
- `server/src/boardAccess.ts` — admins always access; members only via `board_members` ∪ `board_groups`
- `web/src/pages/BoardAccessDialog.tsx` — admin Access dialog (groups + people)
- `server/src/groups.ts` / `routes/groups.ts` — org groups + membership
- `web/src/pages/UsersPage.tsx` — Administration (people, groups, invites, branding)
- `web/src/components/AppShell.tsx` — sidebar on list/admin pages (not tldraw)
- `server/src/kanbanAccess.ts` / `kanbanState.ts` / `kanbanRooms.ts` / `routes/kanban.ts` — kanban access, mutations, live rooms
- `web/src/pages/KanbanListPage.tsx` / `KanbanBoardPage.tsx` — kanban UI (`react-kanban-kit`)
- `web/src/tldraw/kanbanEmbed.tsx` — live-linked `kanban-card` / `kanban-column` shapes
- `server/src/kanbanEmbedSchema.ts` — same custom shapes registered on `TLSocketRoom`
- `server/src/docAccess.ts` / `docRooms.ts` / `routes/docs.ts` — space access, Yjs rooms, REST
- `web/src/pages/SpacesPage.tsx` / `SpacePage.tsx` / `DocEditorPage.tsx` — spaces list, docs in a space, TipTap+Yjs editor
- `web/src/docSync.ts` — y-websocket protocol client with fresh sync-token on each reconnect
- `web/src/tldraw/shapeOwner.ts` — `nanocoreOwner` meta + local owner-label preference
- `web/src/tldraw/ShapeOwnerLayer.tsx` — top-right owner name overlay
- `web/src/tldraw/shapeReactions.ts` / `ShapeReactionsLayer.tsx` — emoji reactions on `nanocoreReactions`
- `web/src/tldraw/BoardCanvasOverlays.tsx` — composes InFrontOfTheCanvas overlays (reactions + owners)
- `web/src/tldraw/BoardMainMenu.tsx` — default hamburger + Owner labels submenu in Preferences

## Data Flow

1. Browser hits SPA (Vite dev or server-served `web/dist`)
2. REST under `/api/*` with `credentials: include` session cookie
3. Board open → WebSocket `/api/sync/:boardId?sessionId=…` (cookie auth on upgrade)
4. `TLSocketRoom` broadcasts changes; `onDataChange` saves RoomSnapshot JSON to SQLite
5. Kanban open → REST mutations + `/api/kanban-sync/:id` broadcasts full JSON state
6. Document open → Yjs `/api/doc-sync/:docId`; server keeps a `Y.Doc` per live document and persists `Y.encodeStateAsUpdate` as a SQLite BLOB

## Key Decisions

- **Single process (Bun)** over Next.js: long-lived WebSockets + SQLite self-host simplicity
- **tldraw v3.x sync** with snapshot persistence (not Cloudflare / not SQLiteSyncStorage — that API is newer than pinned 3.15)
- **Admin-provisioned users** only; temp password + `must_change_password`
- **Single-tenant org** row (`id = 1`) for whitelabel display name
- **Board mutations admin-only** (create/rename/delete). **Access is assigned**: admins always see every board; members see a board if they are in `board_members` **or** in a group listed in `board_groups`. Existing/new boards start with no members. WS upgrade re-checks access; revoke kicks live sockets.
- **Asset access** via HMAC `sig` query (works in `<img>`) or session cookie; SVG uploads blocked
- **Production** requires non-default `SESSION_SECRET`; optional `ALLOWED_ORIGINS` for split UI/API
- **Shape owner** is stamped only on local (`source === 'user'`) creates of note/text/image/geo. Name is a snapshot at place-time. Visibility preference is per-browser (`localStorage`), not synced.
- **InFrontOfTheCanvas** is a single slot — overlays compose in `BoardCanvasOverlays`
- **Resizable notes**: `NanocoreNoteShapeUtil` stores `{w,h}` on `shape.meta.nanocoreNoteSize` (stock schema unchanged). Resize handles are unlocked; text wraps to the new box.
- **Kanban is not tldraw.** Own tables (`kanban_boards/columns/cards/members/groups`, plus `kanban_labels`, `kanban_card_assignees`, `kanban_card_labels`), REST mutations, WebSocket `/api/kanban-sync/:id` broadcasts full state after each change. Access matches whiteboards (admins always; members via people + groups). Cards carry priority, optional `dueDate` (`YYYY-MM-DD` or null), optional recurrence (daily/weekly/monthly/yearly), assignees, labels, and comments in that snapshot. Recurring cards live in three system columns (`recurring_open` / `recurring_progress` / `recurring_done`); they cannot be dragged onto normal columns or vice versa. Each new cycle (next occurrence on or before today) moves the same card back to Open and updates `dueDate`. Comments stay on that card as the log. Calendar paints the same card on every matching day in view. Anyone with board access can comment; author or org admin can delete. Board page has Board / Calendar layouts (`?view=calendar`). Gantt not built.
- **Documents are not last-write-wins.** Concurrent typing uses Yjs (CRDT) over a y-websocket-compatible binary protocol on Bun’s `ServerWebSocket` — not kanban-style full-state snapshots and not stock `y-websocket` (that server wants Node `ws`). TipTap 2.27 Collaboration + CollaborationCursor. Title is SQL (list page can show it without loading the Y.Doc); body is the Yjs blob. Images reuse `/api/assets/upload`.
- **Document access is the space, not the file.** Tables: `doc_spaces`, `doc_space_members`, `doc_space_groups`, `documents`. Admins create/rename/delete spaces and assign people + groups. Anyone with space access sees every document in it and can create/rename/delete docs. Admins always. Named **Spaces** so it doesn’t clash with the org “workspace”. On space access revoke, kick `doc:${docId}` sockets for every document in that space.
- **Shell**: sidebar for product areas (Whiteboards / Kanban / Documents / Administration). Tldraw canvas stays full-bleed with its own top bar. Document editor uses AppShell wide (sidebar stays, editor fills the main pane).
- **Kanban on whiteboards**: custom tldraw shapes hold IDs only; live title/description/column membership comes from the kanban WS. Schema is registered on both `useSync` and `TLSocketRoom`.
- **Future modules (not built):** optional products stay in-process (one Bun, one SQLite, one image). Enable via allowlist + lazy UI; never drop tables; never unregister persisted tldraw shapes. Full plan: `.agent/MODULES.md`. Documents was the third product but was **not** used as the trigger to extract the platform.

## Dependencies

- tldraw / @tldraw/sync / @tldraw/sync-core
- react-kanban-kit (kanban UI; restyled with Nanocore CSS tokens)
- TipTap 2.27 + yjs / y-protocols / lib0 (documents)
- hono
- bun (runtime + bun:sqlite + Bun.password)
- react, react-router-dom, vite
