# Optional product modules (plan)

_Status: **not implemented**. Written 2026-08-24 after discussing how to add features (kanban, docs, time, notes) without every install paying for all of them. Documents shipped 2026-09-02 as the third product **without** extracting this platform (same pattern as kanban: own tables, own routes, copied access helper). Do not start the extraction until we are turning products on/off for real._

Nanocore stays **one app**: one Bun process, one SQLite file, one Docker image, one repo. Products are enableable packages *inside* that app, not plugins, not microservices, not extra containers.

## Goal

An org can turn products on or off so unused ones:

- do not appear in the sidebar
- do not serve HTTP/WS
- do not keep live rooms in memory
- do not download their heavy UI (especially tldraw)

What we are **not** trying to save: git checkout size, Docker image size, or empty SQLite tables. Disabled module data is **kept**.

## What is core vs a module

**Core (always on)**

- Auth, sessions, users, groups, org, branding
- Generic “can this user open resource X?” (people + groups + admins-always)
- HTTP server + websocket upgrade router
- App shell (sidebar is a slot; items come from enabled modules)
- Module catalog: which products are enabled

**A product module owns**

- Its tables (its own `CREATE TABLE` / `ALTER`, run at startup, idempotent)
- Its `/api/…` routes and optional WS path
- Its pages, **lazy-loaded** on the client
- Optional **canvas contributions** (see embeds below)

First two products already look like this in spirit:

| Module | Runtime cost | Notes |
|---|---|---|
| `whiteboard` | High (tldraw rooms + fat JS) | The expensive one. Turning this off is the only disable that really moves RAM/bundle. |
| `kanban` | Low | Own tables + snapshot WS. Cheap when idle. |
| future CRUD (time, notes, docs-without-collab) | Low | Not worth isolating as a process. |

## Enablement

Allowlist, not a marketplace.

- Deploy config first, e.g. env `NANOCORE_MODULES=whiteboard,kanban` (name TBD when implementing).
- Default for existing installs: both current products on, so nothing breaks.
- Admin UI to toggle can come later; it is not required to get the seam.
- Unknown / disabled module → no nav, API 404, WS not mounted.
- **Never drop tables** on disable. Turning kanban off must not delete boards.

Implementation sketch (when we do it):

1. Server reads the allowlist at boot.
2. `await import("./modules/kanban")` only if enabled; that module mounts routes, WS, schema.
3. `GET /api/modules` returns `{ enabled: ["whiteboard", "kanban"] }` for the SPA.
4. Client: sidebar and routes from that list; `React.lazy` / `import()` per product page so a kanban-only session never parses tldraw.

A flag that only hides the nav but still statically imports `BoardPage` is a fake module and does not count.

## Shared access

We **did** copy a third time (`docAccess.ts` for Spaces). Extract one helper when this platform is actually built: admins always; members via `*_members` union `*_groups`. Each module supplies table names / resource id. Whiteboards, kanban, and document spaces already match this rule.

## Cross-module: kanban on whiteboards

This is the landmine. Custom tldraw shapes (`kanban-card`, `kanban-column`) live in the **whiteboard schema**, on both `useSync` and `TLSocketRoom`. Snapshots persist those types. Unregistering them is how you get `CLIENT_TOO_OLD`.

Treat embeds as a **composition**, not as part of either module’s core:

| whiteboard | kanban | Behavior |
|---|---|---|
| on | on | Live embeds, picker, drag between columns |
| on | off | Shape types **stay registered** as inert stubs (“Kanban isn’t enabled”). Never remove them from schema once shipped. |
| off | on | Kanban app works; no canvas, no embeds |
| off | off | Core only |

Rule: once a tldraw shape type has been persisted, it is a forever resident of the whiteboard module. Future canvas features plug into a small contribution list the whiteboard **always** knows about (stub if the donor module is off).

## Folder shape (when extracted)

Stay in `server/` + `web/` until imports hurt. Do **not** add bun workspaces per product yet.

Suggested later layout (illustrative, not a promise):

```
server/src/core/          # auth, users, groups, org, access helper, module catalog
server/src/modules/whiteboard/
server/src/modules/kanban/
web/src/core/
web/src/modules/whiteboard/   # lazy pages + tldraw
web/src/modules/kanban/
```

i18n can stay one `en.ts` / `de.ts` until the third product. Modules contributing catalogs is optional later.

Schema: stop growing the monolith in `db.ts`. Next product owns its DDL in its module file; core still opens the one SQLite file and runs each enabled (and, for safety, **all known**) migrators so disable never leaves the DB unable to re-enable.

## When to actually build this

**Trigger:** starting a third product (docs, notes, time, …), not “because kanban exists.”

Until then, only practice the discipline:

1. Product tables/routes do not go into auth/org/users.
2. Whiteboard does not import kanban except through a narrow embed/contribution API.
3. New product DDL can live next to that product, not only in `db.ts`.
4. Never drop module tables on disable.

## Explicitly out of scope

- Plugin SDK, drop-in folders, third-party modules
- Per-module bun workspaces / npm packages
- Per-module databases or Docker services
- Build-matrix images (`whiteboard-only`, `full`, …)
- Unloading tldraw shape types or SQLite schema when a module is off
- Process isolation

## Why this and not a platform

Self-host value is “one process, one file, one container.” A loader/SDK will cost more than notes or time tracking. Runtime allowlist + lazy UI gets ~90% of the operational win (no live rooms, no tldraw download) without changing how people deploy Nanocore.
