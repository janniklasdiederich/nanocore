import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { env } from "./env";

mkdirSync(env.dataDir, { recursive: true });
mkdirSync(env.uploadsDir, { recursive: true });

export const db = new Database(env.dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS org (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS board_snapshots (
    board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
    snapshot_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invite_links (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    expires_at TEXT NOT NULL,
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (max_uses IS NULL OR max_uses >= 1)
  );

  CREATE TABLE IF NOT EXISTS board_members (
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (board_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_invite_token ON invite_links(token_hash);
  CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS board_groups (
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (board_id, group_id)
  );

  CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_board_groups_group ON board_groups(group_id);

  CREATE TABLE IF NOT EXISTS kanban_boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_members (
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (board_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_groups (
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (board_id, group_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal'
      CHECK (priority IN ('low', 'normal', 'high')),
    due_date TEXT,
    sort_order INTEGER NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_labels (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_card_assignees (
    card_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_card_labels (
    card_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES kanban_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_card_comments (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_kanban_members_user ON kanban_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_kanban_groups_group ON kanban_groups(group_id);
  CREATE INDEX IF NOT EXISTS idx_kanban_columns_board ON kanban_columns(board_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_kanban_cards_col ON kanban_cards(column_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_kanban_labels_board ON kanban_labels(board_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_kanban_card_assignees_user ON kanban_card_assignees(user_id);
  CREATE INDEX IF NOT EXISTS idx_kanban_comments_card ON kanban_card_comments(card_id, created_at);
`);

export type UserRole = "admin" | "member";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  must_change_password: number;
  created_at: string;
};

export type OrgRow = {
  id: number;
  name: string;
  created_at: string;
  logo_filename: string | null;
};

try {
  db.exec(`ALTER TABLE org ADD COLUMN logo_filename TEXT`);
} catch {
  // already exists
}

try {
  db.exec(
    `ALTER TABLE kanban_cards ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`,
  );
} catch {
  // already exists
}

try {
  db.exec(`ALTER TABLE kanban_cards ADD COLUMN due_date TEXT`);
} catch {
  // already exists
}

export type BoardRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isSetupComplete(): boolean {
  const row = db.query("SELECT 1 AS ok FROM org WHERE id = 1").get() as
    | { ok: number }
    | null;
  return row !== null;
}

export function getOrg(): OrgRow | null {
  return db.query("SELECT * FROM org WHERE id = 1").get() as OrgRow | null;
}

export function publicOrg(org: OrgRow | null): {
  name: string;
  logoSrc: string | null;
} | null {
  if (!org) return null;
  return {
    name: org.name,
    logoSrc: org.logo_filename
      ? `/api/org/logo?v=${encodeURIComponent(org.logo_filename)}`
      : null,
  };
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
  };
}
