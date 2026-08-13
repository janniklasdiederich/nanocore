import { useEffect, useState } from "react";
import { api, ApiError, type Board, type BoardAccessUser } from "../api";
import { useT } from "../i18n";

export function BoardAccessDialog({
  board,
  onClose,
}: {
  board: Board;
  onClose: () => void;
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
      .getBoardMembers(board.id)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.users);
        setSelected(
          new Set(
            res.users
              .filter((u) => u.role === "member" && u.assigned)
              .map((u) => u.id),
          ),
        );
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : t("boards.accessLoadFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board.id, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const members = users.filter((u) => u.role === "member");
  const admins = users.filter((u) => u.role === "admin");

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
      await api.setBoardMembers(board.id, [...selected]);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("boards.accessFailed"),
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-access-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal access-modal">
        <h2 id="board-access-title">
          {t("boards.accessTitle", { name: board.name })}
        </h2>
        <p>{t("boards.accessHelp")}</p>
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="center-screen" style={{ minHeight: 120 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="access-list">
            {admins.map((u) => (
              <label key={u.id} className="access-row access-row--locked">
                <input type="checkbox" checked disabled />
                <span className="access-row-text">
                  <span className="access-row-name">{u.displayName}</span>
                  <span className="access-row-email">{u.email}</span>
                </span>
                <span className="badge badge-admin">
                  {t("boards.accessAlways")}
                </span>
              </label>
            ))}
            {members.map((u) => (
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
            {members.length === 0 && (
              <p className="access-empty">{t("boards.accessEmpty")}</p>
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
