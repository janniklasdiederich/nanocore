import { useState } from "react";
import { ApiError, api, type KanbanLabel } from "../api";
import { KANBAN_LABEL_COLORS, labelTextColor } from "../kanbanDisplay";
import { useT } from "../i18n";

export function KanbanLabelsDialog({
  boardId,
  labels,
  onClose,
}: {
  boardId: string;
  labels: KanbanLabel[];
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(KANBAN_LABEL_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      await api.createKanbanLabel(boardId, { name: n, color });
      setName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function rename(label: KanbanLabel) {
    const next = window.prompt(t("kanban.renameLabel"), label.name);
    if (!next || next.trim() === label.name) return;
    try {
      await api.updateKanbanLabel(boardId, label.id, { name: next.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
    }
  }

  async function recolor(label: KanbanLabel, next: string) {
    try {
      await api.updateKanbanLabel(boardId, label.id, { color: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
    }
  }

  async function remove(label: KanbanLabel) {
    if (!window.confirm(t("kanban.deleteLabel", { name: label.name }))) return;
    try {
      await api.deleteKanbanLabel(boardId, label.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
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
      <div className="modal">
        <h2>{t("kanban.manageLabels")}</h2>
        <p>{t("kanban.manageLabelsHelp")}</p>
        {error && <div className="error-banner">{error}</div>}
        <ul className="kb-label-manage-list">
          {labels.length === 0 && (
            <li className="kb-editor-empty">{t("kanban.labelsEmpty")}</li>
          )}
          {labels.map((label) => (
            <li key={label.id} className="kb-label-manage-row">
              <span
                className="kb-label-chip"
                style={{
                  background: label.color,
                  color: labelTextColor(label.color),
                }}
              >
                {label.name}
              </span>
              <div className="kb-color-dots">
                {KANBAN_LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={"kb-color-dot" + (c === label.color ? " is-on" : "")}
                    style={{ background: c }}
                    aria-label={c}
                    onClick={() => void recolor(label, c)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void rename(label)}
              >
                {t("common.rename")}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void remove(label)}
              >
                {t("common.delete")}
              </button>
            </li>
          ))}
        </ul>
        <div className="kb-new-label">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("kanban.newLabel")}
            maxLength={40}
          />
          <div className="kb-color-dots">
            {KANBAN_LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={"kb-color-dot" + (c === color ? " is-on" : "")}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: "auto" }}
            disabled={busy || !name.trim()}
            onClick={() => void add()}
          >
            {t("kanban.addLabel")}
          </button>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
