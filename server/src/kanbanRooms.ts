type Sock = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

const rooms = new Map<string, Set<Sock>>();

export function joinKanbanRoom(boardId: string, sock: Sock): () => void {
  let set = rooms.get(boardId);
  if (!set) {
    set = new Set();
    rooms.set(boardId, set);
  }
  set.add(sock);
  return () => {
    set!.delete(sock);
    if (set!.size === 0) rooms.delete(boardId);
  };
}

export function emitKanban(boardId: string, payload: unknown): void {
  const set = rooms.get(boardId);
  if (!set || set.size === 0) return;
  const raw = JSON.stringify(payload);
  for (const sock of set) {
    try {
      sock.send(raw);
    } catch {
      // ignore
    }
  }
}

export function closeKanbanRoom(boardId: string): void {
  const set = rooms.get(boardId);
  if (!set) return;
  for (const sock of set) {
    try {
      sock.close(1001, "Board deleted");
    } catch {
      // ignore
    }
  }
  rooms.delete(boardId);
}

export function closeAllKanbanRooms(): void {
  for (const boardId of [...rooms.keys()]) {
    closeKanbanRoom(boardId);
  }
}
