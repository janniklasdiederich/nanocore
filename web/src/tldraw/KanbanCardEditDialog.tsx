import { useState, type FormEvent } from "react";
import {
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  type TLUiDialogProps,
} from "tldraw";
import {
  ApiError,
  api,
  type KanbanCard,
  type KanbanPriority,
} from "../api";
import {
  KANBAN_LABEL_COLORS,
  KANBAN_PRIORITIES,
  initials,
  labelTextColor,
} from "../kanbanDisplay";
import { useT } from "../i18n";
import { useKanbanLive } from "./kanbanLive";

export function KanbanCardEditDialog({
  onClose,
  boardId,
  card,
}: TLUiDialogProps & { boardId: string; card: KanbanCard }) {
  const t = useT();
  const live = useKanbanLive(boardId);
  const people = live.status === "ok" ? live.state.people : [];
  const labels = live.status === "ok" ? live.state.labels : [];
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [priority, setPriority] = useState<KanbanPriority>(
    card.priority === "high" || card.priority === "low" ? card.priority : "normal",
  );
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(
    () => new Set(card.assigneeIds ?? []),
  );
  const [labelIds, setLabelIds] = useState<Set<string>>(
    () => new Set(card.labelIds ?? []),
  );
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<string>(
    KANBAN_LABEL_COLORS[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateKanbanCard(boardId, card.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeIds: [...assigneeIds],
        labelIds: [...labelIds],
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.saveFailed"));
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("kanban.deleteCard"))) return;
    setBusy(true);
    try {
      await api.deleteKanbanCard(boardId, card.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.saveFailed"));
      setBusy(false);
    }
  }

  async function createLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await api.createKanbanLabel(boardId, {
        name,
        color: newLabelColor,
      });
      setLabelIds((prev) => new Set(prev).add(res.label.id));
      setNewLabelName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("kanban.labelFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("kanban.editCard")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="nc-kb-edit-dialog">
        {error && <p className="nc-kb-picker-error">{error}</p>}
        <form id="nc-kb-edit-form" onSubmit={(e) => void save(e)}>
          <label className="nc-kb-tl-field" htmlFor="nc-kb-edit-title">
            <span className="nc-kb-tl-label">{t("kanban.cardTitle")}</span>
            <input
              id="nc-kb-edit-title"
              className="nc-kb-tl-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              autoFocus
            />
          </label>
          <label className="nc-kb-tl-field" htmlFor="nc-kb-edit-desc">
            <span className="nc-kb-tl-label">{t("kanban.cardDescription")}</span>
            <textarea
              id="nc-kb-edit-desc"
              className="nc-kb-tl-input nc-kb-tl-input--area"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
            />
          </label>
          <label className="nc-kb-tl-field" htmlFor="nc-kb-edit-priority">
            <span className="nc-kb-tl-label">{t("kanban.priority")}</span>
            <select
              id="nc-kb-edit-priority"
              className="nc-kb-tl-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as KanbanPriority)}
            >
              {KANBAN_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p === "high"
                    ? t("kanban.priority.high")
                    : p === "low"
                      ? t("kanban.priority.low")
                      : t("kanban.priority.normal")}
                </option>
              ))}
            </select>
          </label>
          <div className="nc-kb-tl-field">
            <span className="nc-kb-tl-label">{t("kanban.assignees")}</span>
            <div className="nc-kb-pick-chips">
              {people.map((p) => (
                <label key={p.id} className="nc-kb-check">
                  <input
                    type="checkbox"
                    checked={assigneeIds.has(p.id)}
                    onChange={() => setAssigneeIds((s) => toggle(s, p.id))}
                  />
                  <span className="nc-kb-avatar">{initials(p.displayName)}</span>
                  {p.displayName}
                </label>
              ))}
            </div>
          </div>
          <div className="nc-kb-tl-field">
            <span className="nc-kb-tl-label">{t("kanban.labels")}</span>
            <div className="nc-kb-pick-chips">
              {labels.map((label) => (
                <label key={label.id} className="nc-kb-check">
                  <input
                    type="checkbox"
                    checked={labelIds.has(label.id)}
                    onChange={() => setLabelIds((s) => toggle(s, label.id))}
                  />
                  <span
                    className="nc-kb-chip"
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
            <div className="nc-kb-new-label">
              <input
                className="nc-kb-tl-input"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder={t("kanban.newLabel")}
                maxLength={40}
              />
              <div className="nc-kb-dots">
                {KANBAN_LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      "nc-kb-dot" + (c === newLabelColor ? " is-on" : "")
                    }
                    style={{ background: c }}
                    onClick={() => setNewLabelColor(c)}
                  />
                ))}
              </div>
              <TldrawUiButton
                type="low"
                disabled={busy || !newLabelName.trim()}
                onClick={() => void createLabel()}
              >
                <TldrawUiButtonLabel>{t("kanban.addLabel")}</TldrawUiButtonLabel>
              </TldrawUiButton>
            </div>
          </div>
        </form>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter className="tlui-dialog__footer__actions">
        <TldrawUiButton
          type="danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          <TldrawUiButtonLabel>{t("common.delete")}</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton type="normal" disabled={busy} onClick={onClose}>
          <TldrawUiButtonLabel>{t("common.cancel")}</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton
          type="primary"
          disabled={busy}
          onClick={() => void save()}
        >
          <TldrawUiButtonLabel>
            {busy ? t("common.saving") : t("common.save")}
          </TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  );
}
