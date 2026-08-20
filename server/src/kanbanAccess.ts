import { db, type UserRole, type UserRow } from "./db";

export type KanbanBoardRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function userCanAccessKanban(userId: string, boardId: string): boolean {
  const user = db
    .query("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role: UserRole } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  return memberHasKanbanAccess(userId, boardId);
}

function memberHasKanbanAccess(userId: string, boardId: string): boolean {
  const direct = db
    .query(
      `SELECT 1 AS ok FROM kanban_members WHERE board_id = ? AND user_id = ?`,
    )
    .get(boardId, userId);
  if (direct) return true;
  const viaGroup = db
    .query(
      `SELECT 1 AS ok
       FROM kanban_groups kg
       INNER JOIN group_members gm ON gm.group_id = kg.group_id
       WHERE kg.board_id = ? AND gm.user_id = ?`,
    )
    .get(boardId, userId);
  return viaGroup != null;
}

/** Member user ids (not admins) who currently have access. */
export function memberIdsWithKanbanAccess(boardId: string): Set<string> {
  const ids = new Set<string>();
  const direct = db
    .query(`SELECT user_id FROM kanban_members WHERE board_id = ?`)
    .all(boardId) as { user_id: string }[];
  for (const r of direct) ids.add(r.user_id);
  const via = db
    .query(
      `SELECT gm.user_id AS user_id
       FROM kanban_groups kg
       INNER JOIN group_members gm ON gm.group_id = kg.group_id
       WHERE kg.board_id = ?`,
    )
    .all(boardId) as { user_id: string }[];
  for (const r of via) ids.add(r.user_id);
  return ids;
}

export function listKanbanBoardsForUser(
  userId: string,
  role: UserRole,
): KanbanBoardRow[] {
  if (role === "admin") {
    return db
      .query(`SELECT * FROM kanban_boards ORDER BY updated_at DESC`)
      .all() as KanbanBoardRow[];
  }
  return db
    .query(
      `SELECT DISTINCT b.* FROM kanban_boards b
       LEFT JOIN kanban_members m
         ON m.board_id = b.id AND m.user_id = ?
       LEFT JOIN kanban_groups kg
         ON kg.board_id = b.id
       LEFT JOIN group_members gm
         ON gm.group_id = kg.group_id AND gm.user_id = ?
       WHERE m.user_id IS NOT NULL OR gm.user_id IS NOT NULL
       ORDER BY b.updated_at DESC`,
    )
    .all(userId, userId) as KanbanBoardRow[];
}

export type KanbanAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assigned: boolean;
  viaGroups: string[];
};

export type KanbanAccessGroup = {
  id: string;
  name: string;
  memberCount: number;
  assigned: boolean;
};

export function listKanbanAccess(boardId: string): {
  users: KanbanAccessUser[];
  groups: KanbanAccessGroup[];
} {
  const users = db
    .query(
      `SELECT id, email, display_name, role FROM users ORDER BY display_name COLLATE NOCASE ASC`,
    )
    .all() as Pick<UserRow, "id" | "email" | "display_name" | "role">[];

  const assignedDirect = new Set(
    (
      db
        .query(`SELECT user_id FROM kanban_members WHERE board_id = ?`)
        .all(boardId) as { user_id: string }[]
    ).map((r) => r.user_id),
  );

  const viaByUser = new Map<string, string[]>();
  const viaRows = db
    .query(
      `SELECT gm.user_id AS user_id, g.name AS name
       FROM kanban_groups kg
       INNER JOIN groups g ON g.id = kg.group_id
       INNER JOIN group_members gm ON gm.group_id = g.id
       WHERE kg.board_id = ?`,
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
        .query(`SELECT group_id FROM kanban_groups WHERE board_id = ?`)
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

export function setKanbanAccess(
  boardId: string,
  userIds: string[],
  groupIds: string[] | null,
  grantedBy: string,
): { removedUserIds: string[] } {
  const before = memberIdsWithKanbanAccess(boardId);

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
    db.query(`DELETE FROM kanban_members WHERE board_id = ?`).run(boardId);
    const insertUser = db.query(
      `INSERT INTO kanban_members (board_id, user_id, granted_by) VALUES (?, ?, ?)`,
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
      db.query(`DELETE FROM kanban_groups WHERE board_id = ?`).run(boardId);
      const insertGroup = db.query(
        `INSERT INTO kanban_groups (board_id, group_id, granted_by) VALUES (?, ?, ?)`,
      );
      for (const groupId of nextGroups) {
        insertGroup.run(boardId, groupId, grantedBy);
      }
    }
  });
  apply();

  const after = memberIdsWithKanbanAccess(boardId);
  const removedUserIds = [...before].filter((id) => !after.has(id));
  return { removedUserIds };
}
