import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  type KanbanCard,
  type KanbanCardFields,
  type KanbanLabel,
  type KanbanPerson,
  type KanbanPriority,
} from "../api";
import {
  KANBAN_LABEL_COLORS,
  KANBAN_PRIORITIES,
  initials,
  labelTextColor,
} from "../kanbanDisplay";
import { useT } from "../i18n";

export function KanbanCardEditor({
  card,
  people,
  labels,
  onClose,
  onSave,
  onDelete,
  onCreateLabel,
}: {
  card?: KanbanCard;
  people: KanbanPerson[];
  labels: KanbanLabel[];
  onClose: () => void;
  onSave: (fields: KanbanCardFields & { title: string; description: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<KanbanLabel>;
}) {
  const t = useT();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [priority, setPriority] = useState<KanbanPriority>(
    card?.priority ?? "normal",
  );
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(
    () => new Set(card?.assigneeIds ?? []),
  );
  const [labelIds, setLabelIds] = useState<Set<string>>(
    () => new Set(card?.labelIds ?? []),
  );
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(
    KANBAN_LABEL_COLORS[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeIds: [...assigneeIds],
        labelIds: [...labelIds],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.saveFailed"));
      setBusy(false);
    }
  }

  async function createLabel() {
    const name = newLabelName.trim();
    if (!name || !onCreateLabel) return;
    setBusy(true);
    setError(null);
    try {
      const label = await onCreateLabel(name, newLabelColor);
      setLabelIds((prev) => new Set(prev).add(label.id));
      setNewLabelName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
    } finally {
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
      <form className="modal kb-editor-modal" onSubmit={(e) => void submit(e)}>
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
            rows={4}
          />
        </div>
        <div className="field">
          <label htmlFor="kb-priority">{t("kanban.priority")}</label>
          <select
            id="kb-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as KanbanPriority)}
          >
            {KANBAN_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`kanban.priority.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="kb-editor-legend">{t("kanban.assignees")}</span>
          {people.length === 0 ? (
            <p className="kb-editor-empty">{t("kanban.assigneesEmpty")}</p>
          ) : (
            <div className="kb-chip-list">
              {people.map((p) => (
                <label key={p.id} className="kb-check-chip">
                  <input
                    type="checkbox"
                    checked={assigneeIds.has(p.id)}
                    onChange={() => setAssigneeIds((s) => toggle(s, p.id))}
                  />
                  <span className="kb-avatar" title={p.email}>
                    {initials(p.displayName)}
                  </span>
                  <span>{p.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="field">
          <span className="kb-editor-legend">{t("kanban.labels")}</span>
          <div className="kb-chip-list">
            {labels.map((label) => (
              <label key={label.id} className="kb-check-chip">
                <input
                  type="checkbox"
                  checked={labelIds.has(label.id)}
                  onChange={() => setLabelIds((s) => toggle(s, label.id))}
                />
                <span
                  className="kb-label-chip"
                  style={{
                    background: label.color,
                    color: labelTextColor(label.color),
                  }}
                >
                  {label.name}
                </span>
              </label>
            ))}
          </div>
          {onCreateLabel && (
            <div className="kb-new-label">
              <input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder={t("kanban.newLabel")}
                maxLength={40}
              />
              <div className="kb-color-dots" role="group" aria-label={t("kanban.labelColor")}>
                {KANBAN_LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      "kb-color-dot" + (c === newLabelColor ? " is-on" : "")
                    }
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => setNewLabelColor(c)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || !newLabelName.trim()}
                onClick={() => void createLabel()}
              >
                {t("kanban.addLabel")}
              </button>
            </div>
          )}
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
