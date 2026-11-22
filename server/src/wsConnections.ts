type Tracked = {
  boardId: string;
  userId: string;
  close: () => void;
};

const byBoard = new Map<string, Set<Tracked>>();

export function trackWs(conn: Tracked): () => void {
  const list = byBoard.get(conn.boardId) ?? new Set<Tracked>();
  list.add(conn);
  byBoard.set(conn.boardId, list);
  return () => {
    list.delete(conn);
    if (!list.size) byBoard.delete(conn.boardId);
  };
}

export function closeUserSockets(userId: string): void {
  for (const list of byBoard.values()) {
    for (const conn of list) {
      if (conn.userId === userId) conn.close();
    }
  }
}

/** Close live sync sockets for users who just lost access. */
export function kickUsersFromBoard(boardId: string, userIds: string[]): void {
  if (!userIds.length) return;
  const drop = new Set(userIds);
  const list = byBoard.get(boardId) ?? [];
  for (const conn of list) {
    if (!drop.has(conn.userId)) continue;
    try {
      conn.close();
    } catch {
      // already closed
    }
  }
}
