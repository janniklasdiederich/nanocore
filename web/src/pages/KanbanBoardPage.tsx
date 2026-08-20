import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Kanban,
  dropColumnHandler,
  dropHandler,
  type BoardData,
} from "react-kanban-kit";
import {
  api,
  ApiError,
  type KanbanCard,
  type KanbanState,
} from "../api";
import { AppShell } from "../components/AppShell";
import { syncWsBase } from "../config";
import { useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { KanbanCardEditor } from "./KanbanCardEditor";

export function KanbanBoardPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [state, setState] = useState<KanbanState | null>(null);
  const [dataSource, setDataSource] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    columnId: string;
    card?: KanbanCard;
  } | null>(null);

  useDocumentTitle(state?.board.name ?? t("kanban.loadingName"));

  useEffect(() => {
    if (!id) return;
    let closed = false;
    let ws: WebSocket | null = null;

    void (async () => {
      try {
        const initial = await api.getKanban(id);
        if (closed) return;
        setState(initial);
        setDataSource(toKitData(initial));
        const { token } = await api.getKanbanSyncToken(id);
        const sessionId = crypto.randomUUID();
        const url = `${syncWsBase()}/api/kanban-sync/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as KanbanState & {
              type?: string;
            };
            if (msg.type !== "state" || !msg.board) return;
            const next = {
              board: msg.board,
              columns: msg.columns,
              cards: msg.cards,
            };
            setState(next);
            setDataSource(toKitData(next));
          } catch {
            // ignore malformed
          }
        };
      } catch (err) {
        if (!closed) {
          setError(
            err instanceof ApiError ? err.message : t("kanban.openFailed"),
          );
        }
      }
    })();

    return () => {
      closed = true;
      ws?.close();
    };
  }, [id, t]);

  const cardsById = useMemo(() => {
    const map = new Map<string, KanbanCard>();
    for (const card of state?.cards ?? []) map.set(card.id, card);
    return map;
  }, [state]);

  const configMap = useMemo(
    () => ({
      card: {
        isDraggable: true,
        render: ({ data }: { data: { id: string; title: string } }) => {
          const card = cardsById.get(data.id);
          return (
            <div className="kb-card">
              <div className="kb-card-title">{data.title}</div>
              {card?.description ? (
                <div className="kb-card-desc">{card.description}</div>
              ) : null}
            </div>
          );
        },
      },
    }),
    [cardsById],
  );

  const onCardMove = useCallback(
    (move: {
      cardId: string;
      fromColumnId: string;
      toColumnId: string;
      taskAbove: string | null;
      taskBelow: string | null;
      position: number;
    }) => {
      if (!id || !dataSource) return;
      setDataSource(dropHandler(move, dataSource));
      void api
        .moveKanbanCard(id, move.cardId, {
          columnId: move.toColumnId,
          index: move.position,
        })
        .catch(() => {
          /* WS snapshot will correct */
        });
    },
    [id, dataSource],
  );

  const onColumnMove = useCallback(
    (move: { columnId: string; fromIndex: number; toIndex: number }) => {
      if (!id || !dataSource) return;
      const next = dropColumnHandler(move, dataSource);
      setDataSource(next);
      void api.reorderKanbanColumns(id, next.root.children).catch(() => {});
    },
    [id, dataSource],
  );

  if (!id) {
    return (
      <AppShell title={t("kanban.title")}>
        <div className="empty-state">{t("board.missingId")}</div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title={t("kanban.title")}>
        <div className="auth-card" style={{ margin: "40px auto" }}>
          <h1>{t("kanban.openFailed")}</h1>
          <p className="subtitle">{error}</p>
          <Link className="btn btn-primary" to="/kanban">
            {t("kanban.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!state || !dataSource) {
    return (
      <AppShell title={t("kanban.loadingName")} wide>
        <div className="center-screen" style={{ minHeight: 240 }}>
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={state.board.name} wide>
      <div className="kb-page">
        <div className="kb-toolbar">
          <h1>{state.board.name}</h1>
        </div>
        <div className="kb-board">
          <Kanban
            dataSource={dataSource}
            configMap={configMap}
            virtualization={false}
            allowColumnDrag
            allowColumnAdder
            allowListFooter={() => true}
            cardsGap={8}
            rootClassName="kb-rkk"
            onCardMove={onCardMove}
            onColumnMove={onColumnMove}
            onCardClick={(_e, card) => {
              const existing = cardsById.get(card.id);
              if (!existing) return;
              setEditing({ columnId: existing.columnId, card: existing });
            }}
            renderColumnHeader={(column) => (
              <div className="kb-col-head">
                <strong>{column.title}</strong>
                <span className="kb-col-count">{column.totalChildrenCount}</span>
                <button
                  type="button"
                  className="kb-icon-btn"
                  title={t("common.rename")}
                  onClick={() => {
                    const name = window.prompt(
                      t("kanban.renameColumn"),
                      column.title,
                    );
                    if (!name || name.trim() === column.title) return;
                    void api.renameKanbanColumn(id, column.id, name.trim());
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="kb-icon-btn"
                  title={t("common.delete")}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t("kanban.deleteColumn", { name: column.title }),
                      )
                    ) {
                      return;
                    }
                    void api.deleteKanbanColumn(id, column.id);
                  }}
                >
                  ×
                </button>
              </div>
            )}
            renderListFooter={(column) => (
              <button
                type="button"
                className="kb-add-card"
                onClick={() => setEditing({ columnId: column.id })}
              >
                {t("kanban.addCard")}
              </button>
            )}
            renderColumnAdder={() => (
              <button
                type="button"
                className="kb-add-col"
                onClick={() => {
                  const name = window.prompt(t("kanban.newColumn"), "");
                  if (!name?.trim()) return;
                  void api.addKanbanColumn(id, name.trim());
                }}
              >
                {t("kanban.addColumn")}
              </button>
            )}
          />
        </div>
      </div>
      {editing && (
        <KanbanCardEditor
          card={editing.card}
          onClose={() => setEditing(null)}
          onSave={async (title, description) => {
            if (editing.card) {
              await api.updateKanbanCard(id, editing.card.id, {
                title,
                description,
              });
            } else {
              await api.addKanbanCard(id, {
                columnId: editing.columnId,
                title,
                description,
              });
            }
            setEditing(null);
          }}
          onDelete={
            editing.card
              ? async () => {
                  await api.deleteKanbanCard(id, editing.card!.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </AppShell>
  );
}

function toKitData(state: KanbanState): BoardData {
  const columns = [...state.columns].sort((a, b) => a.sortOrder - b.sortOrder);
  const rootChildren = columns.map((c) => c.id);
  const data: BoardData = {
    root: {
      id: "root",
      title: "root",
      parentId: null,
      children: rootChildren,
      totalChildrenCount: rootChildren.length,
    },
  };
  for (const col of columns) {
    const cards = state.cards
      .filter((c) => c.columnId === col.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    data[col.id] = {
      id: col.id,
      title: col.title,
      parentId: "root",
      children: cards.map((c) => c.id),
      totalChildrenCount: cards.length,
    };
    for (const card of cards) {
      data[card.id] = {
        id: card.id,
        title: card.title,
        parentId: col.id,
        children: [],
        totalChildrenCount: 0,
        type: "card",
        content: { description: card.description },
      };
    }
  }
  return data;
}
