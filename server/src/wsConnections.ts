type Tracked = {
  boardId: string;
  userId: string;
  sessionId: string;
  close: () => void;
};

const byBoard = new Map<string, Tracked[]>();

export function trackWs(conn: Tracked): void {
  const list = byBoard.get(conn.boardId) ?? [];
  list.push(conn);
  byBoard.set(conn.boardId, list);
}

export function untrackWs(boardId: string, sessionId: string): void {
  const list = byBoard.get(boardId);
  if (!list) return;
  const next = list.filter((c) => c.sessionId !== sessionId);
  if (next.length) byBoard.set(boardId, next);
  else byBoard.delete(boardId);
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
