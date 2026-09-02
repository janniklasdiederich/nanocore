# Project Overview

## Goal

Nanocore is an open-source, self-hosted Miro-style collaborative whiteboard. It uses tldraw for the infinite canvas and real-time multiplayer sync over plain WebSockets (no Cloudflare required).

## Scope

**In scope (v0.1):**
- Single-tenant install (one org per deployment, one SQLite file)
- First-run setup: organization display name + admin account
- Admin-created users (email + temporary password; force change on first login)
- Boards list + collaborative canvas with tldraw defaults (shapes, notes, text, images, live cursors)
- Kanban boards (separate from tldraw)
- Documents: live collaborative rich text, grouped into **Spaces** (access is per space)
- Optional Docker / docker-compose

**Out of scope for now:**
- Multi-tenant SaaS
- Public self-registration / email verification
- Suggestion mode / comments-on-selection / Word export for documents
- Extra products beyond whiteboards + kanban + documents (notes, time, …)
- Plugin / marketplace architecture
- Voting, templates, SSO

**Later (not built):** optional in-process product modules so an org can disable unused products. Plan: `.agent/MODULES.md`. Documents shipped like kanban; the platform extraction is still not started.

## Key Users / Consumers

- Small teams self-hosting a private whiteboard
- Admins who provision accounts and manage the org name
- Members who open boards and collaborate live
