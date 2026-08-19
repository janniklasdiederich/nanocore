import { db, type UserRole } from "./db";
import { memberIdsWithAccess } from "./boardAccess";
import { kickUsersFromBoard } from "./wsConnections";

export type GroupRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type GroupPublic = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
};

export function mapGroup(row: GroupRow, memberCount: number): GroupPublic {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    memberCount,
  };
}

export function listGroups(): GroupPublic[] {
  const rows = db
    .query(
      `SELECT g.*,
        (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
       FROM groups g
       ORDER BY g.name COLLATE NOCASE ASC`,
    )
    .all() as (GroupRow & { member_count: number })[];
  return rows.map((r) => mapGroup(r, Number(r.member_count)));
}

export function getGroup(id: string): GroupRow | null {
  return db.query("SELECT * FROM groups WHERE id = ?").get(id) as
    | GroupRow
    | null;
}

export function createGroup(name: string, createdBy: string): GroupPublic {
  const id = crypto.randomUUID();
  db.query(`INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)`).run(
    id,
    name,
    createdBy,
  );
  return mapGroup(getGroup(id)!, 0);
}

export function renameGroup(id: string, name: string): GroupPublic | null {
  const existing = getGroup(id);
  if (!existing) return null;
  db.query(`UPDATE groups SET name = ? WHERE id = ?`).run(name, id);
  const count = (
    db
      .query(`SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?`)
      .get(id) as { n: number }
  ).n;
  return mapGroup(getGroup(id)!, Number(count));
}

export function deleteGroup(id: string): boolean {
  const boards = (
    db
      .query(`SELECT board_id FROM board_groups WHERE group_id = ?`)
      .all(id) as { board_id: string }[]
  ).map((r) => r.board_id);

  const before = new Map(
    boards.map((boardId) => [boardId, memberIdsWithAccess(boardId)]),
  );

  const result = db.query(`DELETE FROM groups WHERE id = ?`).run(id);
  if (!result.changes) return false;

  for (const boardId of boards) {
    const after = memberIdsWithAccess(boardId);
    const removed = [...(before.get(boardId) ?? [])].filter(
      (uid) => !after.has(uid),
    );
    kickUsersFromBoard(boardId, removed);
  }
  return true;
}

export function listGroupMemberIds(groupId: string): string[] {
  return (
    db
      .query(`SELECT user_id FROM group_members WHERE group_id = ?`)
      .all(groupId) as { user_id: string }[]
  ).map((r) => r.user_id);
}

export type GroupMember = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assigned: boolean;
};

export function listGroupMembers(groupId: string): GroupMember[] {
  const assigned = new Set(listGroupMemberIds(groupId));
  const users = db
    .query(
      `SELECT id, email, display_name, role FROM users
       WHERE role = 'member'
       ORDER BY display_name COLLATE NOCASE ASC`,
    )
    .all() as {
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
  }[];
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    role: u.role,
    assigned: assigned.has(u.id),
  }));
}

export function setGroupMembers(groupId: string, userIds: string[]): void {
  const boards = (
    db
      .query(`SELECT board_id FROM board_groups WHERE group_id = ?`)
      .all(groupId) as { board_id: string }[]
  ).map((r) => r.board_id);

  const before = new Map(
    boards.map((boardId) => [boardId, memberIdsWithAccess(boardId)]),
  );

  const valid = new Set(
    (
      db
        .query(`SELECT id FROM users WHERE role = 'member'`)
        .all() as { id: string }[]
    ).map((r) => r.id),
  );
  const next = [...new Set(userIds)].filter((id) => valid.has(id));

  const apply = db.transaction(() => {
    db.query(`DELETE FROM group_members WHERE group_id = ?`).run(groupId);
    const insert = db.query(
      `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`,
    );
    for (const userId of next) insert.run(groupId, userId);
  });
  apply();

  for (const boardId of boards) {
    const after = memberIdsWithAccess(boardId);
    const removed = [...(before.get(boardId) ?? [])].filter(
      (uid) => !after.has(uid),
    );
    kickUsersFromBoard(boardId, removed);
  }
}
