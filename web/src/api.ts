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

  listBoards: () => request<{ boards: Board[] }>("/api/boards"),

  createBoard: (name?: string) =>
    request<{ board: Board }>("/api/boards", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getBoard: (id: string) =>
    request<{ board: Board }>(`/api/boards/${id}`),

  renameBoard: (id: string, name: string) =>
    request<{ board: Board }>(`/api/boards/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteBoard: (id: string) =>
    request<{ ok: boolean }>(`/api/boards/${id}`, { method: "DELETE" }),
};
