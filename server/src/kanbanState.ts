import { db } from "./db";
import type { KanbanBoardRow } from "./kanbanAccess";
import { emitKanban } from "./kanbanRooms";

export type KanbanColumn = {
  id: string;
  boardId: string;
  title: string;
  sortOrder: number;
};

export type KanbanCard = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
  sort_order: number;
}): KanbanColumn {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    sortOrder: row.sort_order,
  };
}

function mapCard(row: {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): KanbanCard {
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function touchKanban(boardId: string): void {
  db.query(
    `UPDATE kanban_boards SET updated_at = datetime('now') WHERE id = ?`,
  ).run(boardId);
}

export function loadKanbanState(boardId: string): KanbanState | null {
  const row = db
    .query("SELECT * FROM kanban_boards WHERE id = ?")
    .get(boardId) as KanbanBoardRow | null;
  if (!row) return null;

  const columns = (
    db
      .query(
        `SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY sort_order ASC`,
      )
      .all(boardId) as {
      id: string;
      board_id: string;
      title: string;
      sort_order: number;
    }[]
  ).map(mapColumn);

  const cards = (
    db
      .query(
        `SELECT * FROM kanban_cards WHERE board_id = ? ORDER BY sort_order ASC, created_at ASC`,
      )
      .all(boardId) as {
      id: string;
      board_id: string;
      column_id: string;
      title: string;
      description: string;
      sort_order: number;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }[]
  ).map(mapCard);

  return { board: mapKanbanBoard(row), columns, cards };
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
      `INSERT INTO kanban_columns (id, board_id, title, sort_order) VALUES (?, ?, ?, ?)`,
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
    `INSERT INTO kanban_columns (id, board_id, title, sort_order) VALUES (?, ?, ?, ?)`,
  ).run(id, boardId, title, max.m + 1000);
  notifyKanban(boardId);
  return mapColumn(
    db.query("SELECT * FROM kanban_columns WHERE id = ?").get(id) as {
      id: string;
      board_id: string;
      title: string;
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
  const existing = (
    db
      .query(`SELECT id FROM kanban_columns WHERE board_id = ?`)
      .all(boardId) as { id: string }[]
  ).map((r) => r.id);
  if (
    existing.length !== columnIds.length ||
    existing.some((id) => !columnIds.includes(id))
  ) {
    return false;
  }
  const apply = db.transaction(() => {
    const upd = db.query(
      `UPDATE kanban_columns SET sort_order = ? WHERE id = ? AND board_id = ?`,
    );
    columnIds.forEach((id, i) => upd.run(i * 1000, id, boardId));
  });
  apply();
  notifyKanban(boardId);
  return true;
}

export function deleteColumn(boardId: string, columnId: string): boolean {
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
    .query(`SELECT id FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .get(columnId, boardId);
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
  notifyKanban(boardId);
  return mapCard(
    db.query("SELECT * FROM kanban_cards WHERE id = ?").get(id) as {
      id: string;
      board_id: string;
      column_id: string;
      title: string;
      description: string;
      sort_order: number;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    },
  );
}

export function updateCard(
  boardId: string,
  cardId: string,
  fields: { title?: string; description?: string },
): boolean {
  const row = db
    .query(`SELECT id FROM kanban_cards WHERE id = ? AND board_id = ?`)
    .get(cardId, boardId);
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
    .query(`SELECT id, column_id FROM kanban_cards WHERE id = ? AND board_id = ?`)
    .get(cardId, boardId) as { id: string; column_id: string } | null;
  if (!card) return false;
  const col = db
    .query(`SELECT id FROM kanban_columns WHERE id = ? AND board_id = ?`)
    .get(toColumnId, boardId);
  if (!col) return false;

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
