import { useEffect, useState } from "react";
import { api, ApiError, type AccessGroup, type BoardAccessUser } from "../api";
import { useT } from "../i18n";

export function GroupMembersDialog({
  group,
  onClose,
  onSaved,
}: {
  group: AccessGroup;
  onClose: () => void;
  onSaved: (memberCount: number) => void;
}) {
  const t = useT();
  const [users, setUsers] = useState<BoardAccessUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getGroupMembers(group.id)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.users);
        setSelected(new Set(res.users.filter((u) => u.assigned).map((u) => u.id)));
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : t("groups.membersLoadFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const ids = [...selected];
      await api.setGroupMembers(group.id, ids);
      onSaved(ids.length);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("groups.membersFailed"),
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal access-modal">
        <h2>{t("groups.membersTitle", { name: group.name })}</h2>
        <p>{t("groups.membersHelp")}</p>
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="center-screen" style={{ minHeight: 120 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="access-list">
            {users.map((u) => (
              <label key={u.id} className="access-row">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggle(u.id)}
                />
                <span className="access-row-text">
                  <span className="access-row-name">{u.displayName}</span>
                  <span className="access-row-email">{u.email}</span>
                </span>
              </label>
            ))}
            {users.length === 0 && (
              <p className="access-empty">{t("groups.membersEmpty")}</p>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: "auto" }}
            disabled={loading || saving}
            onClick={() => void save()}
          >
            {saving ? t("boards.accessSaving") : t("boards.accessSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
