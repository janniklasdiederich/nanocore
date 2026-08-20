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
import { ApiError, api, type KanbanCard } from "../api";
import { useT } from "../i18n";

export function KanbanCardEditDialog({
  onClose,
  boardId,
  card,
}: TLUiDialogProps & { boardId: string; card: KanbanCard }) {
  const t = useT();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateKanbanCard(boardId, card.id, {
        title: title.trim(),
        description: description.trim(),
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

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("kanban.editCard")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="nc-kb-edit-dialog">
        {error && <p className="nc-gif-error">{error}</p>}
        <form
          id="nc-kb-edit-form"
          onSubmit={(e) => void save(e)}
        >
          <div className="field">
            <label htmlFor="nc-kb-edit-title">{t("kanban.cardTitle")}</label>
            <input
              id="nc-kb-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="nc-kb-edit-desc">{t("kanban.cardDescription")}</label>
            <textarea
              id="nc-kb-edit-desc"
              className="kb-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={5}
            />
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
