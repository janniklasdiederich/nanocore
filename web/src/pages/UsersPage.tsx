import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type User } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useT } from "../i18n";

export function UsersPage() {
  const { user: me } = useAuth();
  const t = useT();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listUsers();
      setUsers(res.users);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("users.loadFailed"),
      );
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeUser(user: User) {
    if (!window.confirm(t("users.removeConfirm", { email: user.email }))) {
      return;
    }
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("users.deleteFailed"),
      );
    }
  }

  return (
    <AppShell title={t("users.title")}>
      <div className="page-header">
        <div>
          <h1>{t("users.title")}</h1>
          <p>
            {t("users.subtitle")}{" "}
            <Link to="/">{t("users.backToBoards")}</Link>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() => setShowCreate(true)}
        >
          {t("users.add")}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>{t("users.colName")}</th>
            <th>{t("users.colEmail")}</th>
            <th>{t("users.colRole")}</th>
            <th>{t("users.colStatus")}</th>
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
                  {user.role === "admin"
                    ? t("role.admin")
                    : t("role.member")}
                </span>
              </td>
              <td>
                {user.mustChangePassword ? (
                  <span className="badge">{t("status.tempPassword")}</span>
                ) : (
                  <span className="badge">{t("status.active")}</span>
                )}
              </td>
              <td>
                {user.id !== me?.id && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void removeUser(user)}
                  >
                    {t("common.remove")}
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
  const t = useT();
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
      setError(
        err instanceof ApiError ? err.message : t("users.createFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={onSubmit}>
        <h2>{t("users.createTitle")}</h2>
        <p>{t("users.createHelp")}</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="cu-name">{t("users.displayName")}</label>
          <input
            id="cu-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("common.optional")}
          />
        </div>
        <div className="field">
          <label htmlFor="cu-email">{t("users.email")}</label>
          <input
            id="cu-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cu-pass">{t("users.tempPassword")}</label>
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
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ width: "auto" }}
            disabled={busy}
          >
            {busy ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
