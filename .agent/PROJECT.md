# Project Overview

## Goal

Nanocore is an open-source, self-hosted Miro-style collaborative whiteboard. It uses tldraw for the infinite canvas and real-time multiplayer sync over plain WebSockets (no Cloudflare required).

## Scope

**In scope (v0.1):**
- Single-tenant install (one org per deployment, one SQLite file)
- First-run setup: organization display name + admin account
- Admin-created users (email + temporary password; force change on first login)
- Boards list + collaborative canvas with tldraw defaults (shapes, notes, text, images, live cursors)
- Kanban boards (separate from tldraw) on `feature/kanban`
- Optional Docker / docker-compose

**Out of scope for now:**
- Multi-tenant SaaS
- Public self-registration / email verification
- Multi-product beyond whiteboards + kanban
- Comments, voting, templates, SSO

## Key Users / Consumers

- Small teams self-hosting a private whiteboard
- Admins who provision accounts and manage the org name
- Members who open boards and collaborate live
