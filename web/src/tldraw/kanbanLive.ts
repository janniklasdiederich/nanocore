import { useEffect, useState } from "react";
import { ApiError, api, type KanbanState } from "../api";
import { syncWsBase } from "../config";

export type KanbanLive =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; state: KanbanState }
  | { status: "forbidden" }
  | { status: "error"; message: string };

type Entry = {
  refs: number;
  live: KanbanLive;
  listeners: Set<() => void>;
  ws: WebSocket | null;
  closed: boolean;
};

const cache = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const fn of entry.listeners) fn();
}

async function start(boardId: string, entry: Entry) {
  try {
    const initial = await api.getKanban(boardId);
    if (entry.closed) return;
    entry.live = { status: "ok", state: initial };
    notify(entry);
    const { token } = await api.getKanbanSyncToken(boardId);
    if (entry.closed) return;
    const sessionId = crypto.randomUUID();
    const url = `${syncWsBase()}/api/kanban-sync/${encodeURIComponent(boardId)}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(url);
    entry.ws = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as KanbanState & {
          type?: string;
        };
        if (msg.type !== "state" || !msg.board) return;
        entry.live = {
          status: "ok",
          state: {
            board: msg.board,
            columns: msg.columns,
            cards: msg.cards,
          },
        };
        notify(entry);
      } catch {
        // ignore malformed
      }
    };
  } catch (err) {
    if (entry.closed) return;
    const status = err instanceof ApiError ? err.status : 0;
    entry.live =
      status === 403 || status === 404
        ? { status: "forbidden" }
        : {
            status: "error",
            message: err instanceof Error ? err.message : "error",
          };
    notify(entry);
  }
}

function connect(boardId: string): Entry {
  let entry = cache.get(boardId);
  if (entry) {
    entry.refs += 1;
    return entry;
  }
  entry = {
    refs: 1,
    live: { status: "loading" },
    listeners: new Set(),
    ws: null,
    closed: false,
  };
  cache.set(boardId, entry);
  void start(boardId, entry);
  return entry;
}

function release(boardId: string, entry: Entry, onChange: () => void) {
  entry.listeners.delete(onChange);
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.closed = true;
  try {
    entry.ws?.close();
  } catch {
    // ignore
  }
  cache.delete(boardId);
}

/** Shared live Kanban snapshot for whiteboard embeds (one WS per board). */
export function useKanbanLive(boardId: string): KanbanLive {
  const [live, setLive] = useState<KanbanLive>(() =>
    boardId
      ? (cache.get(boardId)?.live ?? { status: "loading" })
      : { status: "idle" },
  );

  useEffect(() => {
    if (!boardId) {
      setLive({ status: "idle" });
      return;
    }
    const entry = connect(boardId);
    const onChange = () => setLive(entry.live);
    entry.listeners.add(onChange);
    setLive(entry.live);
    return () => release(boardId, entry, onChange);
  }, [boardId]);

  return live;
}
