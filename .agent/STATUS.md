# Project Status

_Last updated: 2026-08-23 after: kanban board/card UI polish

## What's Been Built

- **Monorepo** (`server` + `web` Bun workspaces): Hono API on Bun, React+Vite UI
- **First-run setup**: org name + admin; blocks further setup once complete
- **Auth**: cookie sessions, login/logout, force password change; rate-limited login; session purge; password change kills all sessions
- **Users (admin)**: create with temp password, list, delete; role promote/demote
- **Invites**: magic links with expiry + max uses; rate-limited accept
- **Boards**: **admins only** create/rename/delete + assign access; members list/open only assigned boards; delete closes live room
- **Collab canvas**: **tldraw 3.15.x** + `@tldraw/sync`; `TLSocketRoom` + SQLite snapshots
- **Assets**: signed URLs + session auth; size limit; no SVG; SPA path-contained static serve
- **Security**: prod refuses weak SESSION_SECRET; CORS allowlist; upload caps
- **i18n**: en + de
- **Page backgrounds** + **custom shape colors** (document.meta palette, validationFn patch, theme seed custom-1…N)
- **Colorable frames**: `FrameShapeUtil.configure({ showColors: true })`; stock + custom-* colors; frame validator patched on client/server
- **GIF picker**: More-toolbar button opens Giphy search; server imports a copy as `image/gif` with `isAnimated: true` (autoplay + loop)
- **Fill/dash extras**: True solid fill + dash none via BoardStylePanel
- **Sticky arrows**: NanocoreSelectTool + note anchors (center + 4 mid-edges)
- **Reactions**: shape.meta.nanocoreReactions; InFrontOfTheCanvas overlay (bottom-left)
- **Owner labels**: shape.meta.nanocoreOwner stamped on local create; top-right overlay; Preferences always / hover / never
- **Docker**: single container UI+API+WS; SESSION_SECRET auto; COOKIE_SECURE for HTTP
- **Arrows**: stock tldraw only (rounded-elbow experiment reverted)
- **Sidebar shell** on list/admin pages: Whiteboards / Kanban / Administration. Tldraw canvas stays full-bleed.
- **Kanban** (`feature/kanban`): separate product using `react-kanban-kit`. Own tables + REST + live snapshot WS. Same access as whiteboards (people + groups). Cards: title, description, priority (high/normal/low), optional due date (YYYY-MM-DD), multiple assignees (board-access people), per-board colored labels. Filter/sort on the board page. Whiteboard embeds show the extra fields.

## Current Task / Last Completed

Kanban board and cards got a visual pass: quieter columns, cards lead with labels + title, normal priority is hidden, high priority has a left accent, due dates read as Today/Tomorrow, assignees use stacked colored avatars, filters highlight when active and can be cleared. Same card hierarchy on whiteboard embeds.

Previous: optional card due dates (`YYYY-MM-DD`). Restart the API once so existing DBs get the `due_date` column.

Previous: priority, assignees, labels.

Previous: sidebar + kanban boards.

Previous: org logo/favicon; access groups; resizable stickies.

## Known Issues & TODOs

- [ ] Docker/LAN HTTP copy-paste flaky (Clipboard API needs secure context / localhost or HTTPS)
- [ ] Manually verify multi-client live cursors in two browsers
- [ ] Bookmark unfurl not implemented
- [ ] Board snapshot size not capped
- [ ] Orphaned uploads not cleaned when boards deleted
- [ ] Kanban groups/access not yet on `main` (this is the feature branch)
- [ ] Local DB may still contain leftover `bezier-arrow` records from abandoned experiments
- [ ] Pre-existing shapes have no owner stamp (no backfill)

## Decisions Pending

None blocking. **tldraw remains 3.15** unless licensing/product needs change.
