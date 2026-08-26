import { db } from "./db";
import {
  listKanbanPeople,
  type KanbanBoardRow,
  type KanbanPerson,
} from "./kanbanAccess";
import { emitKanban } from "./kanbanRooms";
import {
  defaultWeeklyRecurrence,
  isRecurringRole,
  nextOccurrenceOnOrAfter,
  parseRecurrence,
  todayIso,
  RECURRING_COLUMN_DEFAULTS,
  type ColumnRole,
  type KanbanRecurrence,
} from "./kanbanRecurrence";

export const KANBAN_PRIORITIES = ["high", "normal", "low"] as const;
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];

export function isKanbanPriority(value: unknown): value is KanbanPriority {
  return (
    value === "high" || value === "normal" || value === "low"
  );
}

const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date only (`YYYY-MM-DD`). Empty string / null clears. */
export function isDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !DUE_DATE.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export type KanbanColumn = {
  id: string;
  boardId: string;
  title: string;
  role: ColumnRole;
  sortOrder: number;
};

export type KanbanCard = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: KanbanPriority;
  dueDate: string | null;
  recurrence: KanbanRecurrence | null;
  assigneeIds: string[];
  labelIds: string[];
  comments: KanbanComment[];
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KanbanComment = {
  id: string;
  cardId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export type KanbanLabel = {
  id: string;
  boardId: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type KanbanState = {
  board: {
    id: string;
    name: string;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  columns: KanbanColumn[];
  cards: KanbanCard[];
  labels: KanbanLabel[];
  people: KanbanPerson[];
};

export function mapKanbanBoard(row: KanbanBoardRow) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapColumn(row: {
  id: string;
  board_id: string;
  title: string;
  role?: string;
  sort_order: number;
}): KanbanColumn {
  const role: ColumnRole = isRecurringRole(row.role)
    ? (row.role as ColumnRole)
    : "normal";
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    role,
    sortOrder: row.sort_order,
  };
}

function mapLabel(row: {
  id: string;
  board_id: string;
  name: string;
  color: string;
  sort_order: number;
}): KanbanLabel {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function mapCard(
  row: {
    id: string;
    board_id: string;
    column_id: string;
    title: string;
    description: string;
    priority?: string;
    due_date?: string | null;
    recurrence?: string | null;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  },
  assigneeIds: string[] = [],
  labelIds: string[] = [],
  comments: KanbanComment[] = [],
): KanbanCard {
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    priority: isKanbanPriority(row.priority) ? row.priority : "normal",
    dueDate: isDueDate(row.due_date) ? row.due_date : null,
    recurrence: parseRecurrence(row.recurrence),
    assigneeIds,
    labelIds,
    comments,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadCard(cardId: string): KanbanCard {
  const row = db.query("SELECT * FROM kanban_cards WHERE id = ?").get(cardId) as {
    id: string;
    board_id: string;
    column_id: string;
    title: string;
    description: string;
    priority?: string;
    due_date?: string | null;
    recurrence?: string | null;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  return mapCard(
    row,
    assigneesFor(cardId),
    labelsFor(cardId),
    commentsFor(cardId),
  );
}

function assigneesFor(cardId: string): string[] {
  return (
    db
      .query(`SELECT user_id FROM kanban_card_assignees WHERE card_id = ?`)
      .all(cardId) as { user_id: string }[]
  ).map((r) => r.user_id);
}

function commentsFor(cardId: string): KanbanComment[] {
  return (
    db
      .query(
        `SELECT c.id AS id, c.card_id AS card_id, c.user_id AS user_id,
                c.body AS body, c.created_at AS created_at,
                u.display_name AS display_name
         FROM kanban_card_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.card_id = ?
         ORDER BY c.created_at DESC`,
      )
      .all(cardId) as {
      id: string;
      card_id: string;
      user_id: string | null;
      body: string;
      created_at: string;
      display_name: string | null;
    }[]
  ).map(mapComment);
}

function mapComment(row: {
  id: string;
  card_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  display_name: string | null;
}): KanbanComment {
  return {
    id: row.id,
    cardId: row.card_id,
    authorId: row.user_id,
    authorName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function labelsFor(cardId: string): string[] {
  return (
    db
      .query(`SELECT label_id FROM kanban_card_labels WHERE card_id = ?`)
      .all(cardId) as { label_id: string }[]
  ).map((r) => r.label_id);
}

function setCardAssignees(boardId: string, cardId: string, userIds: string[]) {
  const allowed = new Set(listKanbanPeople(boardId).map((p) => p.id));
  const next = [...new Set(userIds.filter((id) => allowed.has(id)))];
  db.query(`DELETE FROM kanban_card_assignees WHERE card_id = ?`).run(cardId);
  const insert = db.query(
    `INSERT INTO kanban_card_assignees (card_id, user_id) VALUES (?, ?)`,
  );
  for (const userId of next) insert.run(cardId, userId);
}

function setCardLabels(boardId: string, cardId: string, labelIds: string[]) {
  const valid = new Set(
    (
      db
        .query(`SELECT id FROM kanban_labels WHERE board_id = ?`)
        .all(boardId) as { id: string }[]
    ).map((r) => r.id),
  );
  const next = [...new Set(labelIds.filter((id) => valid.has(id)))];
  db.query(`DELETE FROM kanban_card_labels WHERE card_id = ?`).run(cardId);
  const insert = db.query(
    `INSERT INTO kanban_card_labels (card_id, label_id) VALUES (?, ?)`,
  );
  for (const labelId of next) insert.run(cardId, labelId);
}

export function touchKanban(boardId: string): void {
  db.query(
    `UPDATE kanban_boards SET updated_at = datetime('now') WHERE id = ?`,
  ).run(boardId);
}

function columnRows(boardId: string) {
  return db
    .query(`SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY sort_order ASC`)
    .all(boardId) as {
    id: string;
    board_id: string;
    title: string;
    role?: string;
    sort_order: number;
  }[];
}

function ensureRecurringColumns(boardId: string): boolean {
  const existing = columnRows(boardId);
  const have = new Set(existing.map((c) => c.role ?? "normal"));
  const missing = RECURRING_COLUMN_DEFAULTS.filter((d) => !have.has(d.role));
  if (missing.length === 0) return false;
  const max = existing.reduce((m, c) => Math.max(m, c.sort_order), -1000);
  const insert = db.query(
    `INSERT INTO kanban_columns (id, board_id, title, role, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  missing.forEach((col, i) => {
    insert.run(
      crypto.randomUUID(),
      boardId,
      col.title,
      col.role,
      max + (i + 1) * 1000,
    );
  });
  return true;
}

function recurringOpenId(boardId: string): string | null {
  const row = db
    .query(
      `SELECT id FROM kanban_columns WHERE board_id = ? AND role = 'recurring_open'`,
    )
    .get(boardId) as { id: string } | null;
  return row?.id ?? null;
}

function firstNormalColumnId(boardId: string): string | null {
  const row = db
    .query(
      `SELECT id FROM kanban_columns WHERE board_id = ? AND (role = 'normal' OR role IS NULL) ORDER BY sort_order ASC`,
    )
    .get(boardId) as { id: string } | null;
  return row?.id ?? null;
}

function moveCardToColumn(cardId: string, columnId: string): void {
  const max = db
    .query(
      `SELECT COALESCE(MAX(sort_order), -1000) AS m FROM kanban_cards WHERE column_id = ?`,
    )
    .get(columnId) as { m: number };
  db.query(
    `UPDATE kanban_cards SET column_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(columnId, max.m + 1000, cardId);
}

function advanceRecurringCycles(boardId: string): boolean {
  const today = todayIso();
  const openId = recurringOpenId(boardId);
  if (!openId) return false;
  const rows = db
    .query(
      `SELECT id, column_id, due_date, recurrence FROM kanban_cards WHERE board_id = ? AND recurrence IS NOT NULL`,
    )
    .all(boardId) as {
    id: string;
    column_id: string;
    due_date: string | null;
    recurrence: string | null;
  }[];
  let changed = false;
  for (const row of rows) {
    const rec = parseRecurrence(row.recurrence);
    if (!rec) continue;
    const due = isDueDate(row.due_date) ? row.due_date : null;
    if (due && due >= today) continue;
    const next = nextOccurrenceOnOrAfter(today, rec);
    if (!next) continue;
    db.query(
      `UPDATE kanban_cards SET due_date = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(next, row.id);
    if (row.column_id !== openId) moveCardToColumn(row.id, openId);
    changed = true;
  }
  return changed;
}

export function loadKanbanState(boardId: string): KanbanState | null {
  const row = db
    .query("SELECT * FROM kanban_boards WHERE id = ?")
    .get(boardId) as KanbanBoardRow | null;
  if (!row) return null;

  const seeded = ensureRecurringColumns(boardId);
  const rolled = advanceRecurringCycles(boardId);

  const columns = columnRows(boardId).map(mapColumn);

  const cardRows = db
    .query(
      `SELECT * FROM kanban_cards WHERE board_id = ? ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(boardId) as {
    id: string;
    board_id: string;
    column_id: string;
    title: string;
    description: string;
    priority?: string;
    due_date?: string | null;
    recurrence?: string | null;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }[];

  const assigneesByCard = new Map<string, string[]>();
  const assigneeRows = db
    .query(
      `SELECT a.card_id AS card_id, a.user_id AS user_id
       FROM kanban_card_assignees a
       INNER JOIN kanban_cards c ON c.id = a.card_id
       WHERE c.board_id = ?`,
    )
    .all(boardId) as { card_id: string; user_id: string }[];
  for (const r of assigneeRows) {
    const list = assigneesByCard.get(r.card_id) ?? [];
    list.push(r.user_id);
    assigneesByCard.set(r.card_id, list);
  }

  const labelsByCard = new Map<string, string[]>();
  const cardLabelRows = db
    .query(
      `SELECT cl.card_id AS card_id, cl.label_id AS label_id
       FROM kanban_card_labels cl
       INNER JOIN kanban_cards c ON c.id = cl.card_id
       WHERE c.board_id = ?`,
    )
    .all(boardId) as { card_id: string; label_id: string }[];
  for (const r of cardLabelRows) {
    const list = labelsByCard.get(r.card_id) ?? [];
    list.push(r.label_id);
    labelsByCard.set(r.card_id, list);
  }

  const commentsByCard = new Map<string, KanbanComment[]>();
  const commentRows = db
    .query(
      `SELECT cm.id AS id, cm.card_id AS card_id, cm.user_id AS user_id,
              cm.body AS body, cm.created_at AS created_at,
              u.display_name AS display_name
       FROM kanban_card_comments cm
       LEFT JOIN users u ON u.id = cm.user_id
       INNER JOIN kanban_cards c ON c.id = cm.card_id
       WHERE c.board_id = ?
       ORDER BY cm.created_at DESC`,
    )
    .all(boardId) as {
    id: string;
    card_id: string;
    user_id: string | null;
    body: string;
    created_at: string;
    display_name: string | null;
  }[];
  for (const r of commentRows) {
    const list = commentsByCard.get(r.card_id) ?? [];
    list.push(mapComment(r));
    commentsByCard.set(r.card_id, list);
  }

  const cards = cardRows.map((r) =>
    mapCard(
      r,
      assigneesByCard.get(r.id) ?? [],
      labelsByCard.get(r.id) ?? [],
      commentsByCard.get(r.id) ?? [],
    ),
  );

  const labels = (
    db
      .query(
        `SELECT * FROM kanban_labels WHERE board_id = ? ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
      )
      .all(boardId) as {
      id: string;
      board_id: string;
      name: string;
      color: string;
      sort_order: number;
    }[]
  ).map(mapLabel);

  const state: KanbanState = {
    board: mapKanbanBoard(row),
    columns,
    cards,
    labels,
    people: listKanbanPeople(boardId),
  };
  if (seeded || rolled) {
    touchKanban(boardId);
    emitKanban(boardId, { type: "state", ...state });
  }
  return state;
}

export function notifyKanban(boardId: string): void {
  touchKanban(boardId);
  const state = loadKanbanState(boardId);
  if (state) emitKanban(boardId, { type: "state", ...state });
}

export function createKanbanBoard(
  name: string,
  createdBy: string,
  columnTitles: string[],
): KanbanState {
  const id = crypto.randomUUID();
  const titles =
    columnTitles.length > 0
      ? columnTitles
      : ["To Do", "In Progress", "Done"];

  const apply = db.transaction(() => {
    db.query(
      `INSERT INTO kanban_boards (id, name, created_by) VALUES (?, ?, ?)`,
    ).run(id, name, createdBy);
    const insertCol = db.query(
      `INSERT INTO kanban_columns (id, board_id, title, role, sort_order) VALUES (?, ?, ?, 'normal', ?)`,
    );
    titles.forEach((title, i) => {
      insertCol.run(crypto.randomUUID(), id, title, i * 1000);
    });
  });
  apply();

  const state = loadKanbanState(id);
  if (!state) throw new Error("Failed to create kanban");
  return state;
}

export function addColumn(boardId: string, title: string): KanbanColumn {
  const max = db
    .query(
      `SELECT COALESCE(MAX(sort_order), -1000) AS m FROM kanban_columns WHERE board_id = ?`,
    )
    .get(boardId) as { m: number };
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO kanban_columns (id, board_id, title, role, sort_order) VALUES (?, ?, ?, 'normal', ?)`,
  ).run(id, boardId, title, max.m + 1000);
  notifyKanban(boardId);
  return mapColumn(
    db.query("SELECT * FROM kanban_columns WHERE id = ?").get(id) as {
      id: string;
      board_id: string;
      title: string;
      role?: string;
      sort_order: number;
    },
  );
}

export function renameColumn(
  boardId: string,
  columnId: string,
  title: string,
): boolean {
  const result = db
    .query(
      `UPDATE kanban_columns SET title = ? WHERE id = ? AND board_id = ?`,
    )
    .run(title, columnId, boardId);
  if (!result.changes) return false;
  notifyKanban(boardId);
  return true;
}

export function reorderColumns(boardId: string, columnIds: string[]): boolean {
  const cols = columnRows(boardId).map(mapColumn);
  const normal = cols.filter((c) => c.role === "normal");
  const recurring = RECURRING_COLUMN_DEFAULTS.map((d) =>
    cols.find((c) => c.role === d.role),
  ).filter((c): c is KanbanColumn => Boolean(c));
  const givenNormal = columnIds.filter((id) =>
    normal.some((c) => c.id === id),
  );
  if (
    givenNormal.length !== normal.length ||
    givenNormal.some((id) => !normal.some((c) => c.id === id))
  ) {
    return false;
  }
  const ordered = [...givenNormal, ...recurring.map((c) => c.id)];
  const apply = db.transaction(() => {
    const upd = db.query(
      `UPDATE kanban_columns SET sort_order = ? WHERE id = ? AND board_id = ?`,
    );
    ordered.forEach((id, i) => upd.run(i * 1000, id, boardId));
  });
  apply();
  notifyKanban(boardId);
  return true;
}

export function deleteColumn(boardId: string, columnId: string): boolean {
  const col = db
    .query(`SELECT role FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .get(columnId, boardId) as { role?: string } | null;
  if (!col || isRecurringRole(col.role)) return false;
  const result = db
    .query(`DELETE FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .run(columnId, boardId);
  if (!result.changes) return false;
  notifyKanban(boardId);
  return true;
}

export function addCard(
  boardId: string,
  columnId: string,
  title: string,
  description: string,
  createdBy: string,
): KanbanCard | null {
  const col = db
    .query(`SELECT id, role FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .get(columnId, boardId) as { id: string; role?: string } | null;
  if (!col) return null;
  const max = db
    .query(
      `SELECT COALESCE(MAX(sort_order), -1000) AS m FROM kanban_cards WHERE column_id = ?`,
    )
    .get(columnId) as { m: number };
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO kanban_cards (id, board_id, column_id, title, description, sort_order, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, boardId, columnId, title, description, max.m + 1000, createdBy);
  if (isRecurringRole(col.role)) {
    const rec = defaultWeeklyRecurrence();
    const due = nextOccurrenceOnOrAfter(todayIso(), rec);
    db.query(
      `UPDATE kanban_cards SET recurrence = ?, due_date = ? WHERE id = ?`,
    ).run(JSON.stringify(rec), due, id);
  }
  notifyKanban(boardId);
  return loadCard(id);
}

export function updateCard(
  boardId: string,
  cardId: string,
  fields: {
    title?: string;
    description?: string;
    priority?: KanbanPriority;
    dueDate?: string | null;
    recurrence?: KanbanRecurrence | null;
    assigneeIds?: string[];
    labelIds?: string[];
  },
): boolean {
  const row = db
    .query(`SELECT id, column_id FROM kanban_cards WHERE id = ? AND board_id = ?`)
    .get(cardId, boardId) as { id: string; column_id: string } | null;
  if (!row) return false;
  if (fields.title !== undefined) {
    db.query(
      `UPDATE kanban_cards SET title = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(fields.title, cardId);
  }
  if (fields.description !== undefined) {
    db.query(
      `UPDATE kanban_cards SET description = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(fields.description, cardId);
  }
  if (fields.priority !== undefined) {
    db.query(
      `UPDATE kanban_cards SET priority = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(fields.priority, cardId);
  }
  if (fields.dueDate !== undefined) {
    db.query(
      `UPDATE kanban_cards SET due_date = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(fields.dueDate, cardId);
  }
  if (fields.assigneeIds) {
    setCardAssignees(boardId, cardId, fields.assigneeIds);
    db.query(
      `UPDATE kanban_cards SET updated_at = datetime('now') WHERE id = ?`,
    ).run(cardId);
  }
  if (fields.labelIds) {
    setCardLabels(boardId, cardId, fields.labelIds);
    db.query(
      `UPDATE kanban_cards SET updated_at = datetime('now') WHERE id = ?`,
    ).run(cardId);
  }
  if (fields.recurrence !== undefined) {
    if (fields.recurrence) {
      const due =
        nextOccurrenceOnOrAfter(todayIso(), fields.recurrence) ?? todayIso();
      db.query(
        `UPDATE kanban_cards SET recurrence = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(JSON.stringify(fields.recurrence), due, cardId);
      const col = db
        .query(`SELECT role FROM kanban_columns WHERE id = ?`)
        .get(row.column_id) as { role?: string } | null;
      if (!isRecurringRole(col?.role)) {
        const openId = recurringOpenId(boardId);
        if (openId) moveCardToColumn(cardId, openId);
      }
    } else {
      db.query(
        `UPDATE kanban_cards SET recurrence = NULL, updated_at = datetime('now') WHERE id = ?`,
      ).run(cardId);
      const col = db
        .query(`SELECT role FROM kanban_columns WHERE id = ?`)
        .get(row.column_id) as { role?: string } | null;
      if (isRecurringRole(col?.role)) {
        const normalId = firstNormalColumnId(boardId);
        if (normalId) moveCardToColumn(cardId, normalId);
      }
    }
  }
  notifyKanban(boardId);
  return true;
}

export function addComment(
  boardId: string,
  cardId: string,
  userId: string,
  body: string,
): KanbanComment | null {
  const card = db
    .query(`SELECT id FROM kanban_cards WHERE id = ? AND board_id = ?`)
    .get(cardId, boardId);
  if (!card) return null;
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO kanban_card_comments (id, board_id, card_id, user_id, body)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, boardId, cardId, userId, body);
  notifyKanban(boardId);
  const row = db
    .query(
      `SELECT c.id AS id, c.card_id AS card_id, c.user_id AS user_id,
              c.body AS body, c.created_at AS created_at,
              u.display_name AS display_name
       FROM kanban_card_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
    )
    .get(id) as {
    id: string;
    card_id: string;
    user_id: string | null;
    body: string;
    created_at: string;
    display_name: string | null;
  };
  return mapComment(row);
}

export function deleteComment(
  boardId: string,
  cardId: string,
  commentId: string,
  actorId: string,
  isAdmin: boolean,
): "ok" | "missing" | "forbidden" {
  const row = db
    .query(
      `SELECT id, user_id, card_id FROM kanban_card_comments WHERE id = ? AND board_id = ?`,
    )
    .get(commentId, boardId) as {
    id: string;
    user_id: string | null;
    card_id: string;
  } | null;
  if (!row || row.card_id !== cardId) return "missing";
  if (!isAdmin && row.user_id !== actorId) return "forbidden";
  db.query(`DELETE FROM kanban_card_comments WHERE id = ?`).run(commentId);
  notifyKanban(boardId);
  return "ok";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function addLabel(
  boardId: string,
  name: string,
  color: string,
): KanbanLabel | null {
  if (!HEX.test(color)) return null;
  const max = db
    .query(
      `SELECT COALESCE(MAX(sort_order), -1000) AS m FROM kanban_labels WHERE board_id = ?`,
    )
    .get(boardId) as { m: number };
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO kanban_labels (id, board_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, boardId, name, color.toLowerCase(), max.m + 1000);
  notifyKanban(boardId);
  return mapLabel(
    db.query("SELECT * FROM kanban_labels WHERE id = ?").get(id) as {
      id: string;
      board_id: string;
      name: string;
      color: string;
      sort_order: number;
    },
  );
}

export function updateLabel(
  boardId: string,
  labelId: string,
  fields: { name?: string; color?: string },
): boolean {
  const row = db
    .query(`SELECT id FROM kanban_labels WHERE id = ? AND board_id = ?`)
    .get(labelId, boardId);
  if (!row) return false;
  if (fields.name !== undefined) {
    db.query(`UPDATE kanban_labels SET name = ? WHERE id = ?`).run(
      fields.name,
      labelId,
    );
  }
  if (fields.color !== undefined) {
    if (!HEX.test(fields.color)) return false;
    db.query(`UPDATE kanban_labels SET color = ? WHERE id = ?`).run(
      fields.color.toLowerCase(),
      labelId,
    );
  }
  notifyKanban(boardId);
  return true;
}

export function deleteLabel(boardId: string, labelId: string): boolean {
  const result = db
    .query(`DELETE FROM kanban_labels WHERE id = ? AND board_id = ?`)
    .run(labelId, boardId);
  if (!result.changes) return false;
  notifyKanban(boardId);
  return true;
}

export function moveCard(
  boardId: string,
  cardId: string,
  toColumnId: string,
  toIndex: number,
): boolean {
  const card = db
    .query(
      `SELECT id, column_id, recurrence FROM kanban_cards WHERE id = ? AND board_id = ?`,
    )
    .get(cardId, boardId) as {
    id: string;
    column_id: string;
    recurrence?: string | null;
  } | null;
  if (!card) return false;
  const col = db
    .query(`SELECT id, role FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .get(toColumnId, boardId) as { id: string; role?: string } | null;
  if (!col) return false;
  const repeating = Boolean(parseRecurrence(card.recurrence));
  if (repeating !== isRecurringRole(col.role)) return false;

  const siblings = (
    db
      .query(
        `SELECT id FROM kanban_cards WHERE column_id = ? AND id != ? ORDER BY sort_order ASC, created_at ASC`,
      )
      .all(toColumnId, cardId) as { id: string }[]
  ).map((r) => r.id);

  const idx = Math.max(0, Math.min(toIndex, siblings.length));
  siblings.splice(idx, 0, cardId);

  const apply = db.transaction(() => {
    db.query(
      `UPDATE kanban_cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(toColumnId, cardId);
    const upd = db.query(
      `UPDATE kanban_cards SET sort_order = ? WHERE id = ?`,
    );
    siblings.forEach((id, i) => upd.run(i * 1000, id));
  });
  apply();
  notifyKanban(boardId);
  return true;
}

export function deleteCard(boardId: string, cardId: string): boolean {
  const result = db
    .query(`DELETE FROM kanban_cards WHERE id = ? AND board_id = ?`)
    .run(cardId, boardId);
  if (!result.changes) return false;
  notifyKanban(boardId);
  return true;
}
