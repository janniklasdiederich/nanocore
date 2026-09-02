import { db, type UserRole, type UserRow } from "./db";

export type DocSpaceRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  space_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function userCanAccessSpace(userId: string, spaceId: string): boolean {
  const user = db
    .query("SELECT role FROM users WHERE id = ?")
    .get(userId) as { role: UserRole } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  return memberHasSpaceAccess(userId, spaceId);
}

function memberHasSpaceAccess(userId: string, spaceId: string): boolean {
  const direct = db
    .query(
      `SELECT 1 AS ok FROM doc_space_members WHERE space_id = ? AND user_id = ?`,
    )
    .get(spaceId, userId);
  if (direct) return true;
  const viaGroup = db
    .query(
      `SELECT 1 AS ok
       FROM doc_space_groups sg
       INNER JOIN group_members gm ON gm.group_id = sg.group_id
       WHERE sg.space_id = ? AND gm.user_id = ?`,
    )
    .get(spaceId, userId);
  return viaGroup != null;
}

export function userCanAccessDocument(userId: string, docId: string): boolean {
  const row = db
    .query("SELECT space_id FROM documents WHERE id = ?")
    .get(docId) as { space_id: string } | null;
  if (!row) return false;
  return userCanAccessSpace(userId, row.space_id);
}

/** Member user ids (not admins) who currently have access to the space. */
export function memberIdsWithSpaceAccess(spaceId: string): Set<string> {
  const ids = new Set<string>();
  const direct = db
    .query(`SELECT user_id FROM doc_space_members WHERE space_id = ?`)
    .all(spaceId) as { user_id: string }[];
  for (const r of direct) ids.add(r.user_id);
  const via = db
    .query(
      `SELECT gm.user_id AS user_id
       FROM doc_space_groups sg
       INNER JOIN group_members gm ON gm.group_id = sg.group_id
       WHERE sg.space_id = ?`,
    )
    .all(spaceId) as { user_id: string }[];
  for (const r of via) ids.add(r.user_id);
  return ids;
}

export function listSpacesForUser(
  userId: string,
  role: UserRole,
): (DocSpaceRow & { document_count: number })[] {
  if (role === "admin") {
    return db
      .query(
        `SELECT s.*,
          (SELECT COUNT(*) FROM documents d WHERE d.space_id = s.id) AS document_count
         FROM doc_spaces s
         ORDER BY s.updated_at DESC`,
      )
      .all() as (DocSpaceRow & { document_count: number })[];
  }
  return db
    .query(
      `SELECT DISTINCT s.*,
        (SELECT COUNT(*) FROM documents d WHERE d.space_id = s.id) AS document_count
       FROM doc_spaces s
       LEFT JOIN doc_space_members m
         ON m.space_id = s.id AND m.user_id = ?
       LEFT JOIN doc_space_groups sg
         ON sg.space_id = s.id
       LEFT JOIN group_members gm
         ON gm.group_id = sg.group_id AND gm.user_id = ?
       WHERE m.user_id IS NOT NULL OR gm.user_id IS NOT NULL
       ORDER BY s.updated_at DESC`,
    )
    .all(userId, userId) as (DocSpaceRow & { document_count: number })[];
}

export function listDocumentsInSpace(spaceId: string): DocumentRow[] {
  return db
    .query(
      `SELECT id, space_id, title, created_by, created_at, updated_at
       FROM documents
       WHERE space_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(spaceId) as DocumentRow[];
}

export function mapSpace(row: DocSpaceRow & { document_count?: number }) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: Number(row.document_count ?? 0),
  };
}

export function mapDocument(row: DocumentRow) {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SpaceAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  assigned: boolean;
  viaGroups: string[];
};

export type SpaceAccessGroup = {
  id: string;
  name: string;
  memberCount: number;
  assigned: boolean;
};

export function listSpaceAccess(spaceId: string): {
  users: SpaceAccessUser[];
  groups: SpaceAccessGroup[];
} {
  const users = db
    .query(
      `SELECT id, email, display_name, role FROM users ORDER BY display_name COLLATE NOCASE ASC`,
    )
    .all() as Pick<UserRow, "id" | "email" | "display_name" | "role">[];

  const assignedDirect = new Set(
    (
      db
        .query(`SELECT user_id FROM doc_space_members WHERE space_id = ?`)
        .all(spaceId) as { user_id: string }[]
    ).map((r) => r.user_id),
  );

  const viaByUser = new Map<string, string[]>();
  const viaRows = db
    .query(
      `SELECT gm.user_id AS user_id, g.name AS name
       FROM doc_space_groups sg
       INNER JOIN groups g ON g.id = sg.group_id
       INNER JOIN group_members gm ON gm.group_id = g.id
       WHERE sg.space_id = ?`,
    )
    .all(spaceId) as { user_id: string; name: string }[];
  for (const r of viaRows) {
    const list = viaByUser.get(r.user_id) ?? [];
    list.push(r.name);
    viaByUser.set(r.user_id, list);
  }

  const assignedGroups = new Set(
    (
      db
        .query(`SELECT group_id FROM doc_space_groups WHERE space_id = ?`)
        .all(spaceId) as { group_id: string }[]
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

export function setSpaceAccess(
  spaceId: string,
  userIds: string[],
  groupIds: string[] | null,
  grantedBy: string,
): { removedUserIds: string[] } {
  const before = memberIdsWithSpaceAccess(spaceId);

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
    db.query(`DELETE FROM doc_space_members WHERE space_id = ?`).run(spaceId);
    const insertUser = db.query(
      `INSERT INTO doc_space_members (space_id, user_id, granted_by) VALUES (?, ?, ?)`,
    );
    for (const userId of nextUsers) {
      insertUser.run(spaceId, userId, grantedBy);
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
      db.query(`DELETE FROM doc_space_groups WHERE space_id = ?`).run(spaceId);
      const insertGroup = db.query(
        `INSERT INTO doc_space_groups (space_id, group_id, granted_by) VALUES (?, ?, ?)`,
      );
      for (const groupId of nextGroups) {
        insertGroup.run(spaceId, groupId, grantedBy);
      }
    }
  });
  apply();

  const after = memberIdsWithSpaceAccess(spaceId);
  const removedUserIds = [...before].filter((id) => !after.has(id));
  return { removedUserIds };
}

export function documentIdsInSpace(spaceId: string): string[] {
  return (
    db
      .query(`SELECT id FROM documents WHERE space_id = ?`)
      .all(spaceId) as { id: string }[]
  ).map((r) => r.id);
}
