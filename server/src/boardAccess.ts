import { db, type BoardRow, type UserRole, type UserRow } from "./db";

export function userCanAccessBoard(userId: string, boardId: string): boolean {
  const user = db
    .query("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role: UserRole } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  return memberHasBoardAccess(userId, boardId);
}

function memberHasBoardAccess(userId: string, boardId: string): boolean {
  const direct = db
    .query(
      `SELECT 1 AS ok FROM board_members WHERE board_id = ? AND user_id = ?`,
    )
    .get(boardId, userId);
  if (direct) return true;
  const viaGroup = db
    .query(
      `SELECT 1 AS ok
       FROM board_groups bg
       INNER JOIN group_members gm ON gm.group_id = bg.group_id
       WHERE bg.board_id = ? AND gm.user_id = ?`,
    )
    .get(boardId, userId);
  return viaGroup != null;
}

/** Member user ids (not admins) who currently have access. */
export function memberIdsWithAccess(boardId: string): Set<string> {
  const ids = new Set<string>();
  const direct = db
    .query(`SELECT user_id FROM board_members WHERE board_id = ?`)
    .all(boardId) as { user_id: string }[];
  for (const r of direct) ids.add(r.user_id);
  const via = db
    .query(
      `SELECT gm.user_id AS user_id
       FROM board_groups bg
       INNER JOIN group_members gm ON gm.group_id = bg.group_id
       WHERE bg.board_id = ?`,
    )
    .all(boardId) as { user_id: string }[];
  for (const r of via) ids.add(r.user_id);
  return ids;
}

export function listBoardsForUser(userId: string, role: UserRole): BoardRow[] {
  if (role === "admin") {
    return db
      .query(`SELECT * FROM boards ORDER BY updated_at DESC`)
      .all() as BoardRow[];
  }
  return db
    .query(
      `SELECT DISTINCT b.* FROM boards b
       LEFT JOIN board_members m
         ON m.board_id = b.id AND m.user_id = ?
       LEFT JOIN board_groups bg
         ON bg.board_id = b.id
       LEFT JOIN group_members gm
         ON gm.group_id = bg.group_id AND gm.user_id = ?
       WHERE m.user_id IS NOT NULL OR gm.user_id IS NOT NULL
       ORDER BY b.updated_at DESC`,
    )
    .all(userId, userId) as BoardRow[];
}

export type BoardAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assigned: boolean;
  viaGroups: string[];
};

export type BoardAccessGroup = {
  id: string;
  name: string;
  memberCount: number;
  assigned: boolean;
};

export function listBoardAccess(boardId: string): {
  users: BoardAccessUser[];
  groups: BoardAccessGroup[];
} {
  const users = db
    .query(
      `SELECT id, email, display_name, role FROM users ORDER BY display_name COLLATE NOCASE ASC`,
    )
    .all() as Pick<UserRow, "id" | "email" | "display_name" | "role">[];

  const assignedDirect = new Set(
    (
      db
        .query(`SELECT user_id FROM board_members WHERE board_id = ?`)
        .all(boardId) as { user_id: string }[]
    ).map((r) => r.user_id),
  );

  const viaByUser = new Map<string, string[]>();
  const viaRows = db
    .query(
      `SELECT gm.user_id AS user_id, g.name AS name
       FROM board_groups bg
       INNER JOIN groups g ON g.id = bg.group_id
       INNER JOIN group_members gm ON gm.group_id = g.id
       WHERE bg.board_id = ?`,
    )
    .all(boardId) as { user_id: string; name: string }[];
  for (const r of viaRows) {
    const list = viaByUser.get(r.user_id) ?? [];
    list.push(r.name);
    viaByUser.set(r.user_id, list);
  }

  const assignedGroups = new Set(
    (
      db
        .query(`SELECT group_id FROM board_groups WHERE board_id = ?`)
        .all(boardId) as { group_id: string }[]
    ).map((r) => r.group_id),
  );

  const groups = (
    db
      .query(
        `SELECT g.id, g.name,
          (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
         FROM groups g
         ORDER BY g.name COLLATE NOCASE ASC`,
      )
      .all() as { id: string; name: string; member_count: number }[]
  ).map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: Number(g.member_count),
    assigned: assignedGroups.has(g.id),
  }));

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      assigned: u.role === "admin" || assignedDirect.has(u.id),
      viaGroups: viaByUser.get(u.id) ?? [],
    })),
    groups,
  };
}

export function setBoardMembers(
  boardId: string,
  userIds: string[],
  grantedBy: string,
): { removedUserIds: string[] } {
  return setBoardAccess(boardId, userIds, null, grantedBy);
}

export function setBoardAccess(
  boardId: string,
  userIds: string[],
  groupIds: string[] | null,
  grantedBy: string,
): { removedUserIds: string[] } {
  const before = memberIdsWithAccess(boardId);

  const validMembers = new Set(
    (
      db
        .query(`SELECT id FROM users WHERE role = 'member'`)
        .all() as { id: string }[]
    ).map((r) => r.id),
  );
  const nextUsers = [
    ...new Set(userIds.filter((id) => validMembers.has(id))),
  ];

  const apply = db.transaction(() => {
    db.query(`DELETE FROM board_members WHERE board_id = ?`).run(boardId);
    const insertUser = db.query(
      `INSERT INTO board_members (board_id, user_id, granted_by) VALUES (?, ?, ?)`,
    );
    for (const userId of nextUsers) {
      insertUser.run(boardId, userId, grantedBy);
    }

    if (groupIds) {
      const validGroups = new Set(
        (db.query(`SELECT id FROM groups`).all() as { id: string }[]).map(
          (r) => r.id,
        ),
      );
      const nextGroups = [
        ...new Set(groupIds.filter((id) => validGroups.has(id))),
      ];
      db.query(`DELETE FROM board_groups WHERE board_id = ?`).run(boardId);
      const insertGroup = db.query(
        `INSERT INTO board_groups (board_id, group_id, granted_by) VALUES (?, ?, ?)`,
      );
      for (const groupId of nextGroups) {
        insertGroup.run(boardId, groupId, grantedBy);
      }
    }
  });
  apply();

  const after = memberIdsWithAccess(boardId);
  const removedUserIds = [...before].filter((id) => !after.has(id));
  return { removedUserIds };
}
