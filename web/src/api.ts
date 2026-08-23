import { apiUrl } from "./config";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "member";
  mustChangePassword: boolean;
};

export type Org = { name: string; logoSrc: string | null };

export type Board = {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardAccessUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "member";
  assigned: boolean;
  viaGroups?: string[];
};

export type BoardAccessGroup = {
  id: string;
  name: string;
  memberCount: number;
  assigned: boolean;
};

export type KanbanColumn = {
  id: string;
  boardId: string;
  title: string;
  sortOrder: number;
};

export type KanbanPriority = "high" | "normal" | "low";

export type KanbanPerson = {
  id: string;
  displayName: string;
  email: string;
};

export type KanbanLabel = {
  id: string;
  boardId: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type KanbanCard = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: KanbanPriority;
  dueDate: string | null;
  assigneeIds: string[];
  labelIds: string[];
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KanbanState = {
  board: Board;
  columns: KanbanColumn[];
  cards: KanbanCard[];
  labels: KanbanLabel[];
  people: KanbanPerson[];
};

export type KanbanCardFields = {
  title?: string;
  description?: string;
  priority?: KanbanPriority;
  dueDate?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
};

export type AccessGroup = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
};

export type Invite = {
  id: string;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  active: boolean;
  status: "active" | "expired" | "exhausted" | "revoked";
  /** Only present right after creation */
  token?: string;
  path?: string;
};

export type InvitePreview = {
  valid: boolean;
  org: Org | null;
  expiresAt?: string;
  maxUses?: number | null;
  useCount?: number;
  remainingUses?: number | null;
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || res.statusText,
      res.status,
      (data as { code?: string }).code,
    );
  }
  return data as T;
}

export const api = {
  setupStatus: () =>
    request<{ setupComplete: boolean; org: Org | null }>("/api/setup/status"),

  setup: (body: {
    orgName: string;
    email: string;
    password: string;
    displayName?: string;
  }) =>
    request<{ user: User; org: Org }>("/api/setup", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () =>
    request<{ user: User | null; org: Org | null }>("/api/auth/me"),

  login: (email: string, password: string) =>
    request<{ user: User; org: Org | null }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ user: User }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listUsers: () => request<{ users: User[] }>("/api/users"),

  createUser: (body: {
    email: string;
    password: string;
    displayName?: string;
  }) =>
    request<{ user: User }>("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" }),

  setUserRole: (id: string, role: "admin" | "member") =>
    request<{ user: User }>(`/api/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  uploadOrgLogo: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(apiUrl("/api/org/logo"), {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(
        (data as { error?: string }).error || res.statusText,
        res.status,
      );
    }
    return data as { org: Org };
  },

  deleteOrgLogo: () =>
    request<{ org: Org }>("/api/org/logo", { method: "DELETE" }),

  listGroups: () => request<{ groups: AccessGroup[] }>("/api/groups"),

  createGroup: (name: string) =>
    request<{ group: AccessGroup }>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  renameGroup: (id: string, name: string) =>
    request<{ group: AccessGroup }>(`/api/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteGroup: (id: string) =>
    request<{ ok: boolean }>(`/api/groups/${id}`, { method: "DELETE" }),

  getGroupMembers: (id: string) =>
    request<{ users: BoardAccessUser[] }>(`/api/groups/${id}/members`),

  setGroupMembers: (id: string, userIds: string[]) =>
    request<{ users: BoardAccessUser[] }>(`/api/groups/${id}/members`, {
      method: "PUT",
      body: JSON.stringify({ userIds }),
    }),

  listInvites: () => request<{ invites: Invite[] }>("/api/invites"),

  createInvite: (body: { expiresAt: string; maxUses?: number | null }) =>
    request<{ invite: Invite }>("/api/invites", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revokeInvite: (id: string) =>
    request<{ invite: Invite }>(`/api/invites/${id}/revoke`, {
      method: "POST",
    }),

  deleteInvite: (id: string) =>
    request<{ ok: boolean }>(`/api/invites/${id}`, { method: "DELETE" }),

  previewInvite: async (token: string) => {
    const res = await fetch(
      apiUrl(`/api/invite/${encodeURIComponent(token)}`),
      {
        credentials: "include",
      },
    );
    const data = (await res.json().catch(() => ({}))) as InvitePreview & {
      error?: string;
      code?: string;
    };
    if (res.ok) return data as InvitePreview;
    // 410 still carries org + reason for the invite accept page
    if (res.status === 410 || res.status === 404) {
      return {
        valid: false,
        org: data.org ?? null,
        error: data.error,
        code: data.code,
      };
    }
    throw new ApiError(
      data.error || res.statusText,
      res.status,
      data.code,
    );
  },

  acceptInvite: (
    token: string,
    body: { email: string; password: string; displayName?: string },
  ) =>
    request<{ user: User; org: Org | null }>(
      `/api/invite/${encodeURIComponent(token)}/accept`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  listBoards: () => request<{ boards: Board[] }>("/api/boards"),

  createBoard: (name?: string) =>
    request<{ board: Board }>("/api/boards", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getBoard: (id: string) =>
    request<{ board: Board }>(`/api/boards/${id}`),

  getSyncToken: (id: string) =>
    request<{ token: string; expiresInSec: number }>(
      `/api/boards/${id}/sync-token`,
      { method: "POST" },
    ),

  renameBoard: (id: string, name: string) =>
    request<{ board: Board }>(`/api/boards/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteBoard: (id: string) =>
    request<{ ok: boolean }>(`/api/boards/${id}`, { method: "DELETE" }),

  getBoardMembers: (id: string) =>
    request<{ users: BoardAccessUser[]; groups: BoardAccessGroup[] }>(
      `/api/boards/${id}/members`,
    ),

  setBoardMembers: (
    id: string,
    userIds: string[],
    groupIds?: string[],
  ) =>
    request<{ users: BoardAccessUser[]; groups: BoardAccessGroup[] }>(
      `/api/boards/${id}/members`,
      {
        method: "PUT",
        body: JSON.stringify({ userIds, groupIds }),
      },
    ),

  listKanban: () => request<{ boards: Board[] }>("/api/kanban"),

  createKanban: (name?: string, columns?: string[]) =>
    request<KanbanState>("/api/kanban", {
      method: "POST",
      body: JSON.stringify({ name, columns }),
    }),

  getKanban: (id: string) => request<KanbanState>(`/api/kanban/${id}`),

  getKanbanSyncToken: (id: string) =>
    request<{ token: string; expiresInSec: number }>(
      `/api/kanban/${id}/sync-token`,
      { method: "POST" },
    ),

  renameKanban: (id: string, name: string) =>
    request<{ board: Board }>(`/api/kanban/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteKanban: (id: string) =>
    request<{ ok: boolean }>(`/api/kanban/${id}`, { method: "DELETE" }),

  getKanbanMembers: (id: string) =>
    request<{ users: BoardAccessUser[]; groups: BoardAccessGroup[] }>(
      `/api/kanban/${id}/members`,
    ),

  setKanbanMembers: (
    id: string,
    userIds: string[],
    groupIds?: string[],
  ) =>
    request<{ users: BoardAccessUser[]; groups: BoardAccessGroup[] }>(
      `/api/kanban/${id}/members`,
      {
        method: "PUT",
        body: JSON.stringify({ userIds, groupIds }),
      },
    ),

  addKanbanColumn: (id: string, title: string) =>
    request<{ column: KanbanColumn }>(`/api/kanban/${id}/columns`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  renameKanbanColumn: (id: string, colId: string, title: string) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/columns/${colId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  reorderKanbanColumns: (id: string, columnIds: string[]) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/column-order`, {
      method: "PUT",
      body: JSON.stringify({ columnIds }),
    }),

  deleteKanbanColumn: (id: string, colId: string) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/columns/${colId}`, {
      method: "DELETE",
    }),

  addKanbanCard: (
    id: string,
    body: {
      columnId: string;
      title: string;
      description?: string;
      priority?: KanbanPriority;
      dueDate?: string | null;
      assigneeIds?: string[];
      labelIds?: string[];
    },
  ) =>
    request<{ card: KanbanCard }>(`/api/kanban/${id}/cards`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateKanbanCard: (id: string, cardId: string, body: KanbanCardFields) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  createKanbanLabel: (
    id: string,
    body: { name: string; color: string },
  ) =>
    request<{ label: KanbanLabel }>(`/api/kanban/${id}/labels`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateKanbanLabel: (
    id: string,
    labelId: string,
    body: { name?: string; color?: string },
  ) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/labels/${labelId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteKanbanLabel: (id: string, labelId: string) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/labels/${labelId}`, {
      method: "DELETE",
    }),

  moveKanbanCard: (
    id: string,
    cardId: string,
    body: { columnId: string; index: number },
  ) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/cards/${cardId}/move`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteKanbanCard: (id: string, cardId: string) =>
    request<{ ok: boolean }>(`/api/kanban/${id}/cards/${cardId}`, {
      method: "DELETE",
    }),

  searchGifs: (q: string, offset = 0) =>
    request<{
      configured: boolean;
      gifs: GifHit[];
      offset: number;
      limit: number;
    }>(`/api/gifs?q=${encodeURIComponent(q)}&offset=${offset}`),

  importGif: (id: string) =>
    request<ImportedGif>("/api/gifs/import", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
};

export type GifHit = {
  id: string;
  title: string;
  previewUrl: string;
  w: number;
  h: number;
};

export type ImportedGif = {
  src: string;
  w: number;
  h: number;
  mimeType: string;
  name: string;
};
