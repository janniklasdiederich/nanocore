export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "member";
  mustChangePassword: boolean;
};

export type Org = { name: string };

export type Board = {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
  const res = await fetch(path, {
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
    const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
      credentials: "include",
    });
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
};
