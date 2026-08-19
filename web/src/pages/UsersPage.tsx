import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type AccessGroup,
  type Invite,
  type User,
} from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useI18n, useT } from "../i18n";
import { GroupMembersDialog } from "./GroupMembersDialog";

type AdminTab = "people" | "groups" | "invites";

export function UsersPage() {
  const { user: me } = useAuth();
  const t = useT();
  const { locale } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("people");
  const [showCreate, setShowCreate] = useState(false);
  const [membersFor, setMembersFor] = useState<AccessGroup | null>(null);
  const [freshInvite, setFreshInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  // Create-invite form
  const [expirePreset, setExpirePreset] = useState<"7" | "30" | "custom">(
    "7",
  );
  const [customExpires, setCustomExpires] = useState("");
  const [maxUsesInput, setMaxUsesInput] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, g, inv] = await Promise.all([
        api.listUsers(),
        api.listGroups(),
        api.listInvites(),
      ]);
      setUsers(u.users);
      setGroups(g.groups);
      setInvites(inv.invites);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("users.loadFailed"),
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

  async function setRole(user: User, role: "admin" | "member") {
    const confirmKey =
      role === "admin"
        ? "users.roleConfirmAdmin"
        : "users.roleConfirmMember";
    if (!window.confirm(t(confirmKey, { email: user.email }))) {
      return;
    }
    try {
      const res = await api.setUserRole(user.id, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? res.user : u)),
      );
      // If we demoted ourselves, session still has old role until refresh
      if (user.id === me?.id) {
        await load();
        window.location.reload();
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("users.roleFailed"),
      );
    }
  }

  function resolveExpiresAt(): string {
    if (expirePreset === "custom") {
      if (!customExpires) throw new Error("missing date");
      return new Date(customExpires).toISOString();
    }
    const days = expirePreset === "7" ? 7 : 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    setError(null);
    setCopied(false);
    try {
      let expiresAt: string;
      try {
        expiresAt = resolveExpiresAt();
      } catch {
        setError(t("invites.createFailed"));
        return;
      }
      if (Number.isNaN(new Date(expiresAt).getTime())) {
        setError(t("invites.createFailed"));
        return;
      }

      let maxUses: number | null = null;
      if (maxUsesInput.trim()) {
        const n = Number(maxUsesInput.trim());
        if (!Number.isInteger(n) || n < 1) {
          setError(t("invites.createFailed"));
          return;
        }
        maxUses = n;
      }

      const res = await api.createInvite({ expiresAt, maxUses });
      setFreshInvite(res.invite);
      setInvites((prev) => [res.invite, ...prev]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("invites.createFailed"),
      );
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyFreshLink() {
    if (!freshInvite?.path) return;
    const url = `${window.location.origin}${freshInvite.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t("invites.copy"), url);
    }
  }

  async function revokeInvite(id: string) {
    try {
      const res = await api.revokeInvite(id);
      setInvites((prev) =>
        prev.map((i) => (i.id === id ? res.invite : i)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("invites.revokeFailed"),
      );
    }
  }

  async function deleteInvite(id: string) {
    try {
      await api.deleteInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      if (freshInvite?.id === id) setFreshInvite(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("invites.deleteFailed"),
      );
    }
  }

  const dateLocale = locale === "de" ? "de-DE" : "en-US";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  // datetime-local default for custom: +7 days
  const customMin = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  async function createGroup() {
    const name = window.prompt(t("groups.namePrompt"), "");
    if (!name?.trim()) return;
    try {
      const res = await api.createGroup(name.trim());
      setGroups((prev) =>
        [...prev, res.group].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("groups.createFailed"),
      );
    }
  }

  async function renameGroup(group: AccessGroup) {
    const name = window.prompt(t("groups.namePrompt"), group.name);
    if (!name?.trim() || name.trim() === group.name) return;
    try {
      const res = await api.renameGroup(group.id, name.trim());
      setGroups((prev) =>
        prev
          .map((g) => (g.id === group.id ? res.group : g))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("groups.renameFailed"),
      );
    }
  }

  async function removeGroup(group: AccessGroup) {
    if (!window.confirm(t("groups.deleteConfirm", { name: group.name }))) {
      return;
    }
    try {
      await api.deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("groups.deleteFailed"),
      );
    }
  }

  return (
    <AppShell title={t("admin.title")}>
      <div className="page-header">
        <div>
          <h1>{t("admin.title")}</h1>
          <p>
            {t("admin.subtitle")}{" "}
            <Link to="/">{t("users.backToBoards")}</Link>
          </p>
        </div>
        {tab === "people" && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={() => setShowCreate(true)}
          >
            {t("users.add")}
          </button>
        )}
        {tab === "groups" && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={() => void createGroup()}
          >
            {t("groups.add")}
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-tabs" role="tablist">
        {(
          [
            ["people", t("admin.tabPeople")],
            ["groups", t("admin.tabGroups")],
            ["invites", t("admin.tabInvites")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={
              tab === id ? "admin-tab admin-tab--active" : "admin-tab"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invites" && (
      <section className="admin-section">
        <h2 className="admin-section__title">{t("invites.title")}</h2>
        <p className="admin-section__sub">{t("invites.subtitle")}</p>

        <form className="invite-form" onSubmit={(e) => void createInvite(e)}>
          <div className="invite-form__row">
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label htmlFor="inv-exp">{t("invites.expires")}</label>
              <select
                id="inv-exp"
                value={expirePreset}
                onChange={(e) =>
                  setExpirePreset(e.target.value as "7" | "30" | "custom")
                }
              >
                <option value="7">{t("invites.preset7d")}</option>
                <option value="30">{t("invites.preset30d")}</option>
                <option value="custom">{t("invites.presetCustom")}</option>
              </select>
            </div>
            {expirePreset === "custom" && (
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label htmlFor="inv-custom">{t("invites.expires")}</label>
                <input
                  id="inv-custom"
                  type="datetime-local"
                  value={customExpires}
                  min={customMin}
                  onChange={(e) => setCustomExpires(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="field" style={{ marginBottom: 0, flex: 1 }}>
              <label htmlFor="inv-uses">{t("invites.maxUses")}</label>
              <input
                id="inv-uses"
                type="number"
                min={1}
                max={10000}
                placeholder={t("invites.maxUsesPlaceholder")}
                value={maxUsesInput}
                onChange={(e) => setMaxUsesInput(e.target.value)}
              />
              <span className="field-hint">{t("invites.maxUsesHint")}</span>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "auto", marginTop: 12 }}
            disabled={creatingInvite}
          >
            {creatingInvite ? t("common.creating") : t("invites.create")}
          </button>
        </form>

        {freshInvite?.path && (
          <div className="invite-fresh">
            <p>{t("invites.generated")}</p>
            <code className="invite-fresh__url">
              {window.location.origin}
              {freshInvite.path}
            </code>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void copyFreshLink()}
            >
              {copied ? t("invites.copied") : t("invites.copy")}
            </button>
          </div>
        )}

        {invites.length === 0 ? (
          <p className="admin-section__sub" style={{ marginTop: 16 }}>
            {t("invites.empty")}
          </p>
        ) : (
          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>{t("invites.colLink")}</th>
                <th>{t("invites.colExpires")}</th>
                <th>{t("invites.colUses")}</th>
                <th>{t("invites.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span
                      className={
                        inv.status === "active"
                          ? "badge badge-admin"
                          : "badge"
                      }
                    >
                      {t(`invites.status.${inv.status}`)}
                    </span>
                  </td>
                  <td>{fmt(inv.expiresAt)}</td>
                  <td>
                    {inv.maxUses == null
                      ? t("invites.usesUnlimited", { count: inv.useCount })
                      : t("invites.usesLimited", {
                          count: inv.useCount,
                          max: inv.maxUses,
                        })}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {inv.status === "active" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void revokeInvite(inv.id)}
                        >
                          {t("invites.revoke")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void deleteInvite(inv.id)}
                      >
                        {t("invites.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      )}

      {tab === "groups" && (
      <section className="admin-section">
        <h2 className="admin-section__title">{t("groups.title")}</h2>
        <p className="admin-section__sub">{t("groups.subtitle")}</p>
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>{t("groups.empty")}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("groups.colName")}</th>
                <th>{t("groups.colMembers")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>
                    {t("groups.memberCount", { count: group.memberCount })}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMembersFor(group)}
                      >
                        {t("groups.manage")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void renameGroup(group)}
                      >
                        {t("common.rename")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void removeGroup(group)}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      )}

      {tab === "people" && (
      <section className="admin-section">
        <h2 className="admin-section__title">{t("admin.tabPeople")}</h2>
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {user.role === "member" ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void setRole(user, "admin")}
                      >
                        {t("users.makeAdmin")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void setRole(user, "member")}
                      >
                        {t("users.makeMember")}
                      </button>
                    )}
                    {user.id !== me?.id && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void removeUser(user)}
                      >
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, user]);
            setShowCreate(false);
          }}
        />
      )}
      {membersFor && (
        <GroupMembersDialog
          group={membersFor}
          onClose={() => setMembersFor(null)}
          onSaved={(memberCount) => {
            setGroups((prev) =>
              prev.map((g) =>
                g.id === membersFor.id ? { ...g, memberCount } : g,
              ),
            );
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
