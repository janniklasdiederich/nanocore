# Project Status

_Last updated: 2026-08-12 after: clipboard fallback for Docker/HTTP copy-paste_

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
- **Page backgrounds** + **custom shape colors** (document.meta palette, validationFn patch, theme seed custom-1…N)
- **Docker**: single container UI+API+WS; SESSION_SECRET auto; COOKIE_SECURE for HTTP
- **Clipboard fallback** (`web/src/clipboardSecureFallback.ts`): polyfills `navigator.clipboard.write`/`writeText` on non-secure HTTP so tldraw copy/paste works when opened via LAN IP (not only localhost)

## Current Task / Last Completed

Fixed Docker-vs-local copy/paste of stickies/shapes. Root cause: Clipboard API missing outside secure contexts; tldraw throws on `navigator.clipboard.writeText` without optional chaining. Polyfill writes via legacy `copy` + `execCommand` so paste event gets `text/html` with `data-tldraw`.

## Known Issues & TODOs

- [ ] Manually verify multi-client live cursors in two browsers
- [ ] Bookmark unfurl not implemented
- [ ] Board snapshot size not capped
- [ ] Orphaned uploads not cleaned when boards deleted
- [ ] Whitelabel is org name only
- [ ] Local DB may still contain leftover `bezier-arrow` records from abandoned experiments
- [ ] Prefer HTTPS (or http://localhost) for best clipboard interop with other apps

## Decisions Pending

None blocking.
