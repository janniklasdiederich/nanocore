import { TLSocketRoom, type RoomSnapshot } from "@tldraw/sync-core";
import { db } from "./db";

type RoomEntry = {
  room: TLSocketRoom;
  boardId: string;
  saveTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, RoomEntry>();
const SAVE_DEBOUNCE_MS = 800;

function loadSnapshot(boardId: string): RoomSnapshot | undefined {
  const row = db
    .query("SELECT snapshot_json FROM board_snapshots WHERE board_id = ?")
    .get(boardId) as { snapshot_json: string } | null;
  if (!row) return undefined;
  try {
    return JSON.parse(row.snapshot_json) as RoomSnapshot;
  } catch {
    return undefined;
  }
}

function persistSnapshot(boardId: string, room: TLSocketRoom): void {
  const snapshot = room.getCurrentSnapshot();
  const json = JSON.stringify(snapshot);
  db.query(
    `INSERT INTO board_snapshots (board_id, snapshot_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(board_id) DO UPDATE SET
       snapshot_json = excluded.snapshot_json,
       updated_at = datetime('now')`,
  ).run(boardId, json);
  db.query(
    `UPDATE boards SET updated_at = datetime('now') WHERE id = ?`,
  ).run(boardId);
}

function scheduleSave(entry: RoomEntry): void {
  if (entry.saveTimer) clearTimeout(entry.saveTimer);
  entry.saveTimer = setTimeout(() => {
    entry.saveTimer = null;
    try {
      persistSnapshot(entry.boardId, entry.room);
    } catch (err) {
      console.error("Failed to persist board", entry.boardId, err);
    }
  }, SAVE_DEBOUNCE_MS);
}

export function getActiveRoom(boardId: string): TLSocketRoom | null {
  const existing = rooms.get(boardId);
  if (existing && !existing.room.isClosed()) {
    return existing.room;
  }
  return null;
}

export function makeOrLoadRoom(boardId: string): TLSocketRoom {
  const existing = getActiveRoom(boardId);
  if (existing) {
    return existing;
  }

  const board = db
    .query("SELECT id FROM boards WHERE id = ?")
    .get(boardId) as { id: string } | null;
  if (!board) {
    throw new Error("BOARD_NOT_FOUND");
  }

  const initialSnapshot = loadSnapshot(boardId);

  const entry: RoomEntry = {
    boardId,
    room: null as unknown as TLSocketRoom,
    saveTimer: null,
  };

  const room = new TLSocketRoom({
    initialSnapshot,
    onDataChange() {
      scheduleSave(entry);
    },
    onSessionRemoved(roomRef, args) {
      if (args.numSessionsRemaining === 0) {
        if (entry.saveTimer) {
          clearTimeout(entry.saveTimer);
          entry.saveTimer = null;
        }
        try {
          persistSnapshot(boardId, roomRef);
        } catch (err) {
          console.error("Final persist failed", boardId, err);
        }
        try {
          roomRef.close();
        } catch {
          // already closed
        }
        rooms.delete(boardId);
      }
    },
  });

  entry.room = room;
  rooms.set(boardId, entry);
  return room;
}

export function closeAllRooms(): void {
  for (const entry of rooms.values()) {
    if (entry.saveTimer) {
      clearTimeout(entry.saveTimer);
      entry.saveTimer = null;
    }
    try {
      persistSnapshot(entry.boardId, entry.room);
    } catch {
      // ignore
    }
    try {
      entry.room.close();
    } catch {
      // ignore
    }
  }
  rooms.clear();
}
