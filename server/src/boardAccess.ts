import { db, type BoardRow, type UserRole, type UserRow } from "./db";

export function userCanAccessBoard(userId: string, boardId: string): boolean {
  const user = db
    .query("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role: UserRole } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  const row = db
    .query(
      `SELECT 1 AS ok FROM board_members WHERE board_id = ? AND user_id = ?`,
    )
    .get(boardId, userId);
  return row != null;
}

export function listBoardsForUser(userId: string, role: UserRole): BoardRow[] {
  if (role === "admin") {
    return db
      .query(`SELECT * FROM boards ORDER BY updated_at DESC`)
      .all() as BoardRow[];
  }
  return db
    .query(
      `SELECT b.* FROM boards b
       INNER JOIN board_members m ON m.board_id = b.id
       WHERE m.user_id = ?
       ORDER BY b.updated_at DESC`,
    )
    .all(userId) as BoardRow[];
}

export type BoardAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assigned: boolean;
};

export function listBoardAccess(boardId: string): BoardAccessUser[] {
  const users = db
    .query(
      `SELECT id, email, display_name, role FROM users ORDER BY display_name COLLATE NOCASE ASC`,
    )
    .all() as Pick<UserRow, "id" | "email" | "display_name" | "role">[];

  const assigned = new Set(
    (
      db
        .query(`SELECT user_id FROM board_members WHERE board_id = ?`)
        .all(boardId) as { user_id: string }[]
    ).map((r) => r.user_id),
  );

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    role: u.role,
    assigned: u.role === "admin" || assigned.has(u.id),
  }));
}

/** Replace member assignments. Admin ids are ignored (admins always have access). */
export function setBoardMembers(
  boardId: string,
  userIds: string[],
  grantedBy: string,
): { removedUserIds: string[] } {
  const unique = [...new Set(userIds.filter((id) => typeof id === "string" && id))];

  const validMembers = new Set(
    (
      db
        .query(`SELECT id FROM users WHERE role = 'member'`)
        .all() as { id: string }[]
    ).map((r) => r.id),
  );

  const next = unique.filter((id) => validMembers.has(id));

  const prev = (
    db
      .query(`SELECT user_id FROM board_members WHERE board_id = ?`)
      .all(boardId) as { user_id: string }[]
  ).map((r) => r.user_id);

  const nextSet = new Set(next);
  const removedUserIds = prev.filter((id) => !nextSet.has(id));

  const apply = db.transaction(() => {
    db.query(`DELETE FROM board_members WHERE board_id = ?`).run(boardId);
    const insert = db.query(
      `INSERT INTO board_members (board_id, user_id, granted_by) VALUES (?, ?, ?)`,
    );
    for (const userId of next) {
      insert.run(boardId, userId, grantedBy);
    }
  });
  apply();

  return { removedUserIds };
}
