# Project Status

_Last updated: 2026-08-11 after: initial scaffold — setup/auth/boards/sync/docker_

## What's Been Built

- **Monorepo** (`server` + `web` Bun workspaces): Hono API on Bun, React+Vite UI
- **First-run setup**: org name + admin; blocks further setup once complete
- **Auth**: cookie sessions, login/logout, force password change for invited users
- **Users (admin)**: create with temp password, list, delete (not self / not last admin)
- **Boards CRUD**: create, rename, delete, list
- **Collab canvas**: tldraw + `@tldraw/sync` client; `@tldraw/sync-core` `TLSocketRoom` on Bun WebSockets; snapshots in SQLite; image upload
- **People menu**: locked display names; portaled dropdown; follow/jump
- **i18n**: English + German (type-safe catalogs); language switcher; tldraw locale synced
- **Docker**: Dockerfile + docker-compose with volume for `/data`

## Current Task / Last Completed

Added en/de i18n with `web/src/i18n/en.ts` as source of truth and `de.ts` required to match all keys.

## Known Issues & TODOs

- [ ] Manually verify multi-client live cursors in two browsers (WS path + Vite proxy)
- [ ] Bookmark unfurl endpoint not implemented (tldraw bookmarks may be limited)
- [ ] No rate limiting / brute-force protection on login
- [ ] Board snapshot size not capped
- [ ] Roles later: board-level permissions if needed
- [ ] Whitelabel is org **name** only (logo/theme later)

## Decisions Pending

None blocking. Product can grow roles/whitelabel branding next.
