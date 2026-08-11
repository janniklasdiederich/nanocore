# Project Status

_Last updated: 2026-08-11 after: hard-reset custom arrow work → stock tldraw arrows_

## What's Been Built

- **Monorepo** (`server` + `web` Bun workspaces): Hono API on Bun, React+Vite UI
- **First-run setup**: org name + admin; blocks further setup once complete
- **Auth**: cookie sessions, login/logout, force password change for invited users
- **Users (admin)**: create with temp password, list, delete; role promote/demote
- **Invites**: magic links with expiry + max uses
- **Boards CRUD**: create, rename, delete, list
- **Collab canvas**: tldraw + `@tldraw/sync`; `TLSocketRoom` + SQLite snapshots; image upload
- **People menu**: locked display names; portaled dropdown; follow/jump
- **i18n**: en + de; language switcher; tldraw locale synced
- **Text**: font size on rich-text toolbar, markdown-on-edit-end
- **Assets**: download original opens in new tab
- **Production**: `start:web` + runtime `dist/config.js` for API/WS URLs
- **Arrows**: **stock tldraw only** (straight/arc/elbow) — all custom curve experiments removed
- **Docker**: Dockerfile + docker-compose with volume for `/data`

## Current Task / Last Completed

Hard-reset main to `a8033fa` (`revert: remove custom arrow curves, restore stock tldraw arrows`). Dropped unpushed commits:
- cubic-bezier S-curve arrows
- schema/useSync fixes for those shapes
- sticky binding for bezier arrows

`web/src/tldraw/bezierArrows/` and `server/src/tldrawSchema.ts` are gone. BoardPage uses default tldraw arrows with no shapeUtils/tools override.

## Known Issues & TODOs

- [ ] Manually verify multi-client live cursors in two browsers (WS path + Vite proxy)
- [ ] Bookmark unfurl endpoint not implemented
- [ ] No rate limiting / brute-force protection on login
- [ ] Board snapshot size not capped
- [ ] Whitelabel is org **name** only (logo/theme later)
- [ ] Custom Miro-like S-curve arrows abandoned for now (stock only)

## Decisions Pending

None blocking. Revisit arrows only with a clearer UX target if needed again.
