import { useEffect, useState, type FormEvent } from "react";
import { ApiError, type KanbanCard } from "../api";
import { useT } from "../i18n";

export function KanbanCardEditor({
  card,
  onClose,
  onSave,
  onDelete,
}: {
  card?: KanbanCard;
  onClose: () => void;
  onSave: (title: string, description: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(title.trim(), description.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.saveFailed"));
      setBusy(false);
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
      <form className="modal" onSubmit={(e) => void submit(e)}>
        <h2>{card ? t("kanban.editCard") : t("kanban.newCard")}</h2>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="kb-title">{t("kanban.cardTitle")}</label>
          <input
            id="kb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="kb-desc">{t("kanban.cardDescription")}</label>
          <textarea
            id="kb-desc"
            className="kb-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={5}
          />
        </div>
        <div className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              style={{ marginRight: "auto" }}
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t("kanban.deleteCard"))) return;
                setBusy(true);
                void onDelete();
              }}
            >
              {t("common.delete")}
            </button>
          )}
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
            {busy ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
