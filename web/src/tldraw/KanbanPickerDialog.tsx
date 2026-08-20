import { useCallback, useEffect, useState } from "react";
import {
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  createShapeId,
  useEditor,
  type TLUiDialogProps,
} from "tldraw";
import {
  ApiError,
  api,
  type Board,
  type KanbanCard,
  type KanbanColumn,
  type KanbanState,
} from "../api";
import { useT } from "../i18n";
import {
  KANBAN_CARD_H,
  KANBAN_CARD_TYPE,
  KANBAN_CARD_W,
  KANBAN_COLUMN_H,
  KANBAN_COLUMN_TYPE,
  KANBAN_COLUMN_W,
} from "./kanbanEmbed";

export function KanbanPickerDialog({ onClose }: TLUiDialogProps) {
  const editor = useEditor();
  const t = useT();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selected, setSelected] = useState<KanbanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listKanban();
      setBoards(res.boards);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanbanEmbed.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  async function openBoard(board: Board) {
    setLoading(true);
    setError(null);
    try {
      const state = await api.getKanban(board.id);
      setSelected(state);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanbanEmbed.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  function placeAtCenter(
    type: typeof KANBAN_CARD_TYPE | typeof KANBAN_COLUMN_TYPE,
    w: number,
    h: number,
    props: Record<string, string | number>,
  ) {
    const center = editor.getViewportPageBounds().center;
    editor.run(() => {
      editor.markHistoryStoppingPoint("insert kanban embed");
      editor.createShape({
        id: createShapeId(),
        type,
        x: center.x - w / 2,
        y: center.y - h / 2,
        props,
      });
    });
    onClose();
  }

  function placeCard(boardId: string, card: KanbanCard) {
    placeAtCenter(KANBAN_CARD_TYPE, KANBAN_CARD_W, KANBAN_CARD_H, {
      w: KANBAN_CARD_W,
      h: KANBAN_CARD_H,
      boardId,
      cardId: card.id,
    });
  }

  function placeColumn(boardId: string, column: KanbanColumn) {
    placeAtCenter(KANBAN_COLUMN_TYPE, KANBAN_COLUMN_W, KANBAN_COLUMN_H, {
      w: KANBAN_COLUMN_W,
      h: KANBAN_COLUMN_H,
      boardId,
      columnId: column.id,
    });
  }

  const columns = selected
    ? [...selected.columns].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("kanbanEmbed.pickTitle")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="nc-kb-picker">
        <p className="nc-kb-picker-help">{t("kanbanEmbed.pickHelp")}</p>
        {error && <p className="nc-gif-error">{error}</p>}
        {loading && <p className="nc-gif-status">{t("common.loading")}</p>}
        {!loading && !selected && boards.length === 0 && (
          <p className="nc-gif-status">{t("kanbanEmbed.noBoards")}</p>
        )}
        {!loading && !selected && boards.length > 0 && (
          <ul className="nc-kb-picker-list">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  className="nc-kb-picker-board"
                  onClick={() => void openBoard(board)}
                >
                  {board.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <>
            <button
              type="button"
              className="nc-kb-picker-back"
              onClick={() => setSelected(null)}
            >
              ← {selected.board.name}
            </button>
            {columns.map((col) => {
              const cards = selected.cards
                .filter((c) => c.columnId === col.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <section key={col.id} className="nc-kb-picker-col">
                  <div className="nc-kb-picker-col-head">
                    <strong>{col.title}</strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => placeColumn(selected.board.id, col)}
                    >
                      {t("kanbanEmbed.placeColumn")}
                    </button>
                  </div>
                  {cards.length === 0 ? (
                    <p className="nc-gif-status">{t("kanbanEmbed.emptyColumn")}</p>
                  ) : (
                    <ul className="nc-kb-picker-list">
                      {cards.map((card) => (
                        <li key={card.id}>
                          <button
                            type="button"
                            className="nc-kb-picker-card"
                            onClick={() => placeCard(selected.board.id, card)}
                          >
                            <span className="nc-kb-embed-card-title">
                              {card.title}
                            </span>
                            {card.description ? (
                              <span className="nc-kb-embed-card-desc">
                                {card.description}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        )}
      </TldrawUiDialogBody>
    </>
  );
}
