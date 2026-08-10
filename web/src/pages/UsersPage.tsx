import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type User } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listUsers();
      setUsers(res.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeUser(user: User) {
    if (!window.confirm(`Remove ${user.email}?`)) return;
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Users">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>
            Only admins can create accounts.{" "}
            <Link to="/">← Back to boards</Link>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() => setShowCreate(true)}
        >
          Add user
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.displayName}</td>
              <td>{user.email}</td>
              <td>
                <span
                  className={
                    user.role === "admin" ? "badge badge-admin" : "badge"
                  }
                >
                  {user.role}
                </span>
              </td>
              <td>
                {user.mustChangePassword ? (
                  <span className="badge">temp password</span>
                ) : (
                  <span className="badge">active</span>
                )}
              </td>
              <td>
                {user.id !== me?.id && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void removeUser(user)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, user]);
            setShowCreate(false);
          }}
        />
      )}
    </AppShell>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.createUser({
        email,
        password,
        displayName: displayName || undefined,
      });
      onCreated(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={onSubmit}>
        <h2>Add user</h2>
        <p>
          They sign in with this email and temporary password, then must choose
          a new password.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="cu-name">Display name</label>
          <input
            id="cu-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="field">
          <label htmlFor="cu-email">Email</label>
          <input
            id="cu-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cu-pass">Temporary password</label>
          <input
            id="cu-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ width: "auto" }}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
