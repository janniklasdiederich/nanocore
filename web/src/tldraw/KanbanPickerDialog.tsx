import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TldrawUiButton,
  TldrawUiButtonLabel,
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
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
    setOpening(true);
    setError(null);
    try {
      const state = await api.getKanban(board.id);
      setSelected(state);
      setQuery("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanbanEmbed.loadFailed"),
      );
    } finally {
      setOpening(false);
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

  const q = query.trim().toLowerCase();
  const visibleBoards = useMemo(
    () =>
      boards.filter((b) => !q || b.name.toLowerCase().includes(q)),
    [boards, q],
  );

  const columns = selected
    ? [...selected.columns].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const filteredColumns = selected
    ? columns
        .map((col) => {
          const cards = selected.cards
            .filter((c) => c.columnId === col.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter(
              (c) =>
                !q ||
                c.title.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q) ||
                col.title.toLowerCase().includes(q),
            );
          const colMatch = !q || col.title.toLowerCase().includes(q);
          return { col, cards, colMatch };
        })
        .filter(({ cards, colMatch }) => colMatch || cards.length > 0)
    : [];

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("kanbanEmbed.pickTitle")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="nc-kb-picker">
        <p className="nc-kb-picker-help">{t("kanbanEmbed.pickHelp")}</p>
        <input
          type="search"
          className="nc-kb-tl-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            selected
              ? t("kanbanEmbed.searchCards")
              : t("kanbanEmbed.searchBoards")
          }
          aria-label={
            selected
              ? t("kanbanEmbed.searchCards")
              : t("kanbanEmbed.searchBoards")
          }
          autoFocus
        />
        {error && <p className="nc-kb-picker-error">{error}</p>}
        {loading && <p className="nc-kb-picker-muted">{t("common.loading")}</p>}
        {opening && (
          <p className="nc-kb-picker-muted">{t("kanbanEmbed.loading")}</p>
        )}

        {!loading && !selected && boards.length === 0 && (
          <p className="nc-kb-picker-muted">{t("kanbanEmbed.noBoards")}</p>
        )}
        {!loading && !selected && boards.length > 0 && visibleBoards.length === 0 && (
          <p className="nc-kb-picker-muted">{t("kanbanEmbed.noMatches")}</p>
        )}
        {!loading && !selected && visibleBoards.length > 0 && (
          <ul className="nc-kb-picker-list">
            {visibleBoards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  className="nc-kb-picker-row"
                  disabled={opening}
                  onClick={() => void openBoard(board)}
                >
                  <span className="nc-kb-picker-row-title">{board.name}</span>
                  <span className="nc-kb-picker-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="nc-kb-picker-board">
            <div className="nc-kb-picker-toolbar">
              <TldrawUiButton
                type="low"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                }}
              >
                <TldrawUiButtonLabel>
                  {t("kanbanEmbed.backToBoards")}
                </TldrawUiButtonLabel>
              </TldrawUiButton>
              <span className="nc-kb-picker-board-name">
                {selected.board.name}
              </span>
            </div>
            {filteredColumns.length === 0 && (
              <p className="nc-kb-picker-muted">{t("kanbanEmbed.noMatches")}</p>
            )}
            {filteredColumns.map(({ col, cards }) => (
              <section key={col.id} className="nc-kb-pick-col">
                <div className="nc-kb-pick-col-head">
                  <div className="nc-kb-pick-col-title">
                    <strong>{col.title}</strong>
                    <span className="nc-kb-pick-col-count">
                      {t("kanbanEmbed.cardCount", { count: cards.length })}
                    </span>
                  </div>
                  <TldrawUiButton
                    type="low"
                    onClick={() => placeColumn(selected.board.id, col)}
                  >
                    <TldrawUiButtonLabel>
                      {t("kanbanEmbed.placeColumn")}
                    </TldrawUiButtonLabel>
                  </TldrawUiButton>
                </div>
                {cards.length === 0 ? (
                  <p className="nc-kb-picker-muted">
                    {t("kanbanEmbed.emptyColumn")}
                  </p>
                ) : (
                  <ul className="nc-kb-picker-list">
                    {cards.map((card) => (
                      <li key={card.id}>
                        <button
                          type="button"
                          className="nc-kb-picker-row nc-kb-picker-row--card"
                          onClick={() => placeCard(selected.board.id, card)}
                        >
                          <span className="nc-kb-picker-row-title">
                            {card.title}
                          </span>
                          {card.description ? (
                            <span className="nc-kb-picker-row-desc">
                              {card.description}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </TldrawUiDialogBody>
    </>
  );
}
