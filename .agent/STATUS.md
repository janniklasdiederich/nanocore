# Project Status

_Last updated: 2026-09-02 after: Documents with Spaces access_

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
- **Sidebar shell** on list/admin pages: Whiteboards / Kanban / Documents / Administration. Tldraw canvas stays full-bleed.
- **Kanban**: separate product using `react-kanban-kit`. Own tables + REST + live snapshot WS. Same access as whiteboards (people + groups). Cards: title, description, priority (high/normal/low), optional due date (YYYY-MM-DD), multiple assignees (board-access people), per-board colored labels, comments. Filter/sort on the board page. Board / Calendar view switcher (`?view=calendar`) with Day / Week / Month (`&cal=day|week`). Undated tray. Whiteboard embeds show the extra fields. Recurring cards: one standing card in three system columns; next-due is the next matching day on or after today.
- **Documents**: Google Docs-like live editor (TipTap 2.27 + Yjs). Access is **per space**, not per document. Admin creates/renames/deletes spaces and assigns people + groups. Anyone with space access can create/rename/delete documents in that space and edit them live (cursors, rich text, images via existing asset upload). Routes: `/spaces`, `/spaces/:id`, `/docs/:id`. WS: `/api/doc-sync/:id`.

## Current Task / Last Completed

Documents shipped as the third product, **without** extracting the module platform. Access unit is a **Space** (not “workspace” — that clashes with the org). Restart the API once so existing DBs get `doc_spaces`, `doc_space_members`, `doc_space_groups`, and `documents`.

Previous: duplicate whiteboard page copies that page’s background color.

Previous: always snapping forced on every board mount (`isSnapMode: true`).

Previous: recurring kanban next-due is the next matching day.

## Known Issues & TODOs

- [ ] Docker/LAN HTTP copy-paste flaky (Clipboard API needs secure context / localhost or HTTPS)
- [ ] Manually verify multi-client live cursors in two browsers (whiteboard + documents)
- [ ] Bookmark unfurl not implemented
- [ ] Board snapshot size not capped (same for document Yjs blobs)
- [ ] Orphaned uploads not cleaned when boards/documents deleted
- [ ] Local DB may still contain leftover `bezier-arrow` records from abandoned experiments
- [ ] Pre-existing shapes have no owner stamp (no backfill)
- [ ] Documents v1 has no suggestion mode, comments-on-selection, or Word export
- [ ] Access helper is still copied (`boardAccess` / `kanbanAccess` / `docAccess`) — extract when the module platform is built

## Decisions Pending

- Optional product modules: approach agreed on paper (`.agent/MODULES.md`); **still not implemented**. Documents was the third product but shipped like kanban (copy the access helper, always-on nav). Enablement mechanism (env vs admin UI) left until we actually extract modules.
- **tldraw remains 3.15** unless licensing/product needs change.
