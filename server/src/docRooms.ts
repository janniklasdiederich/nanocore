import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { db } from "./db";

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;
const SAVE_DEBOUNCE_MS = 800;

export type DocSock = {
  send: (data: Uint8Array) => void;
  close: (code?: number, reason?: string) => void;
};

type Conn = {
  sessionId: string;
  sock: DocSock;
  clientIds: Set<number>;
};

type DocRoom = {
  docId: string;
  spaceId: string;
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<string, Conn>;
  saveTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, DocRoom>();

function asUint8(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function send(sock: DocSock, data: Uint8Array): void {
  try {
    sock.send(data);
  } catch {
    // already closed
  }
}

function persistRoom(room: DocRoom): void {
  const update = Y.encodeStateAsUpdate(room.ydoc);
  db.query(
    `UPDATE documents
     SET yjs_state = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(update, room.docId);
  db.query(
    `UPDATE doc_spaces SET updated_at = datetime('now') WHERE id = ?`,
  ).run(room.spaceId);
}

function scheduleSave(room: DocRoom): void {
  if (room.saveTimer) clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => {
    room.saveTimer = null;
    try {
      persistRoom(room);
    } catch (err) {
      console.error("[docs] persist failed", room.docId, err);
    }
  }, SAVE_DEBOUNCE_MS);
}

function flushSave(room: DocRoom): void {
  if (room.saveTimer) {
    clearTimeout(room.saveTimer);
    room.saveTimer = null;
  }
  try {
    persistRoom(room);
  } catch (err) {
    console.error("[docs] persist failed", room.docId, err);
  }
}

function loadRoom(docId: string): DocRoom | null {
  const existing = rooms.get(docId);
  if (existing) return existing;

  const row = db
    .query(`SELECT id, space_id, yjs_state FROM documents WHERE id = ?`)
    .get(docId) as {
    id: string;
    space_id: string;
    yjs_state: unknown;
  } | null;
  if (!row) return null;

  const ydoc = new Y.Doc();
  const blob = asUint8(row.yjs_state);
  if (blob && blob.byteLength > 0) {
    Y.applyUpdate(ydoc, blob, "load");
  }

  const awareness = new awarenessProtocol.Awareness(ydoc);
  awareness.setLocalState(null);

  const room: DocRoom = {
    docId,
    spaceId: row.space_id,
    ydoc,
    awareness,
    conns: new Map(),
    saveTimer: null,
  };

  ydoc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === "load") return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    for (const conn of room.conns.values()) {
      send(conn.sock, message);
    }
    scheduleSave(room);
  });

  awareness.on(
    "update",
    (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const changed = changes.added.concat(changes.updated, changes.removed);
      if (origin && typeof origin === "object" && "clientIds" in origin) {
        const conn = origin as Conn;
        for (const id of changes.added) conn.clientIds.add(id);
        for (const id of changes.removed) conn.clientIds.delete(id);
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
      );
      const message = encoding.toUint8Array(encoder);
      for (const conn of room.conns.values()) {
        send(conn.sock, message);
      }
    },
  );

  rooms.set(docId, room);
  return room;
}

export function joinDocRoom(
  docId: string,
  sessionId: string,
  sock: DocSock,
): boolean {
  const room = loadRoom(docId);
  if (!room) return false;

  const conn: Conn = { sessionId, sock, clientIds: new Set() };
  room.conns.set(sessionId, conn);

  const step1 = encoding.createEncoder();
  encoding.writeVarUint(step1, messageSync);
  syncProtocol.writeSyncStep1(step1, room.ydoc);
  send(sock, encoding.toUint8Array(step1));

  const states = room.awareness.getStates();
  if (states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(states.keys()),
      ),
    );
    send(sock, encoding.toUint8Array(encoder));
  }

  return true;
}

export function handleDocMessage(
  docId: string,
  sessionId: string,
  raw: string | Buffer | ArrayBuffer | Uint8Array,
): void {
  const room = rooms.get(docId);
  if (!room) return;
  const conn = room.conns.get(sessionId);
  if (!conn) return;
  if (typeof raw === "string") return;

  const message = asUint8(raw);
  if (!message || message.byteLength === 0) return;

  try {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, conn);
        if (encoding.length(encoder) > 1) {
          send(conn.sock, encoding.toUint8Array(encoder));
        }
        break;
      }
      case messageQueryAwareness: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            Array.from(room.awareness.getStates().keys()),
          ),
        );
        send(conn.sock, encoding.toUint8Array(encoder));
        break;
      }
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[docs] ws message error", docId, err);
  }
}

export function leaveDocRoom(docId: string, sessionId: string): void {
  const room = rooms.get(docId);
  if (!room) return;
  const conn = room.conns.get(sessionId);
  if (!conn) return;
  room.conns.delete(sessionId);
  if (conn.clientIds.size > 0) {
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(conn.clientIds),
      null,
    );
  }
  if (room.conns.size === 0) {
    flushSave(room);
    room.awareness.destroy();
    room.ydoc.destroy();
    rooms.delete(docId);
  }
}

export function closeDocRoom(docId: string): void {
  const room = rooms.get(docId);
  if (!room) return;
  for (const conn of room.conns.values()) {
    try {
      conn.sock.close(1001, "Document deleted");
    } catch {
      // ignore
    }
  }
  flushSave(room);
  room.awareness.destroy();
  room.ydoc.destroy();
  rooms.delete(docId);
}

export function closeDocsInSpace(spaceId: string): void {
  const ids = (
    db
      .query(`SELECT id FROM documents WHERE space_id = ?`)
      .all(spaceId) as { id: string }[]
  ).map((r) => r.id);
  for (const id of ids) closeDocRoom(id);
}

export function closeAllDocRooms(): void {
  for (const id of [...rooms.keys()]) {
    closeDocRoom(id);
  }
}
