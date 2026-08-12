# Project Status

_Last updated: 2026-08-12 after: stay on tldraw 3.15; deleted v5 spike branch_

## What's Been Built

- **Monorepo** (`server` + `web` Bun workspaces): Hono API on Bun, React+Vite UI
- **First-run setup**: org name + admin; blocks further setup once complete
- **Auth**: cookie sessions, login/logout, force password change; rate-limited login; session purge; password change kills all sessions
- **Users (admin)**: create with temp password, list, delete; role promote/demote
- **Invites**: magic links with expiry + max uses; rate-limited accept
- **Boards**: members list/open; **admins only** create/rename/delete; delete closes live room
- **Collab canvas**: **tldraw 3.15.x** + `@tldraw/sync`; `TLSocketRoom` + SQLite snapshots
- **Assets**: signed URLs + session auth; size limit; no SVG; SPA path-contained static serve
- **Security**: prod refuses weak SESSION_SECRET; CORS allowlist; upload caps
- **i18n**: en + de
- **Page backgrounds** + **custom shape colors** (document.meta palette, validationFn patch, theme seed custom-1…N)
- **Docker**: single container UI+API+WS; SESSION_SECRET auto; COOKIE_SECURE for HTTP
- **Arrows**: stock tldraw only

## Current Task / Last Completed

Staying on **tldraw v3**. Spike branch `upgrade/tldraw-v5-bare` deleted (local + `origin`). Reason: v4/v5 require a production license key on HTTPS domains; v3 still runs on real domains with watermark-only enforcement. Clipboard polyfill for Docker HTTP was attempted and **reverted** (`685085e`).

## Known Issues & TODOs

- [ ] Docker/LAN HTTP copy-paste flaky (Clipboard API needs secure context / localhost or HTTPS)
- [ ] Manually verify multi-client live cursors in two browsers
- [ ] Bookmark unfurl not implemented
- [ ] Board snapshot size not capped
- [ ] Orphaned uploads not cleaned when boards deleted
- [ ] Whitelabel is org name only
- [ ] Local DB may still contain leftover `bezier-arrow` records from abandoned experiments

## Decisions Pending

None blocking. **tldraw remains 3.15** unless licensing/product needs change.
