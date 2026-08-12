# Project Status

_Last updated: 2026-08-11 after: security hardening + admin-only board mutations_

## What's Been Built

- **Monorepo** (`server` + `web` Bun workspaces): Hono API on Bun, React+Vite UI
- **First-run setup**: org name + admin; blocks further setup once complete
- **Auth**: cookie sessions, login/logout, force password change; rate-limited login; session purge; password change kills all sessions
- **Users (admin)**: create with temp password, list, delete; role promote/demote
- **Invites**: magic links with expiry + max uses; rate-limited accept
- **Boards**: members list/open; **admins only** create/rename/delete; delete closes live room
- **Collab canvas**: tldraw + `@tldraw/sync`; `TLSocketRoom` + SQLite snapshots
- **Assets**: signed URLs + session auth; size limit; no SVG; SPA path-contained static serve
- **Security**: prod refuses weak SESSION_SECRET; CORS allowlist; upload caps
- **i18n**: en + de
- **Arrows**: stock tldraw only
- **Docker**: requires SESSION_SECRET; ALLOWED_ORIGINS / MAX_UPLOAD_BYTES

## Current Task / Last Completed

Implemented audit fixes: assets, CORS/secrets, SPA path safety, rate limits, session hygiene, board admin permissions, room close on delete, dead code (`tldraw` dep, unused auth helper), Dockerfile lockfile, UI hides board mutation for members.

## Known Issues & TODOs

- [ ] Manually verify multi-client live cursors in two browsers
- [ ] Bookmark unfurl not implemented
- [ ] Board snapshot size not capped
- [ ] Orphaned uploads not cleaned when boards deleted
- [ ] Whitelabel is org name only
- [ ] Local DB may still contain leftover `bezier-arrow` records from abandoned experiments

## Decisions Pending

None blocking.
