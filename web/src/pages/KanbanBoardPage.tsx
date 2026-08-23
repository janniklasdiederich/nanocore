import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type KanbanLabel,
  type KanbanPerson,
  type KanbanPriority,
  type KanbanState,
} from "../api";
import { AppShell } from "../components/AppShell";
import { syncWsBase } from "../config";
import {
  dueStatus,
  formatDueDate,
  initials,
  isDueDate,
  labelTextColor,
  localTodayIso,
} from "../kanbanDisplay";
import { useI18n, useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { KanbanCardEditor } from "./KanbanCardEditor";
import { KanbanLabelsDialog } from "./KanbanLabelsDialog";

type SortKey = "board" | "priority" | "title" | "due";
type DueFilter = "" | "overdue" | "upcoming" | "none";
type View = {
  sort: SortKey;
  priority: "" | KanbanPriority;
  due: DueFilter;
  assignee: "" | "none" | string;
  label: "" | "none" | string;
};

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
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [view, setView] = useState<View>({
    sort: "board",
    priority: "",
    due: "",
    assignee: "",
    label: "",
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  useDocumentTitle(state?.board.name ?? t("kanban.loadingName"));

  useEffect(() => {
    if (!id) return;
    let closed = false;
    let ws: WebSocket | null = null;

    void (async () => {
      try {
        const initial = await api.getKanban(id);
        if (closed) return;
        const first = normalizeKanbanState(initial);
        setState(first);
        setDataSource(toKitData(first, viewRef.current));
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
            const next = normalizeKanbanState(msg);
            setState(next);
            setDataSource(toKitData(next, viewRef.current));
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

  useEffect(() => {
    if (state) setDataSource(toKitData(state, view));
  }, [state, view]);

  const configMap = useMemo(
    () => ({
      card: {
        isDraggable: true,
        render: ({ data }: { data: { id: string; title: string } }) => {
          const card = cardsById.get(data.id);
          if (!card) {
            return (
              <div className="kb-card">
                <div className="kb-card-title">{data.title}</div>
              </div>
            );
          }
          return (
            <KanbanCardFace
              card={card}
              labels={state?.labels ?? []}
              people={state?.people ?? []}
            />
          );
        },
      },
    }),
    [cardsById, state],
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
          <div className="kb-toolbar-tools">
            <label className="kb-filter">
              <span>{t("kanban.sort")}</span>
              <select
                value={view.sort}
                onChange={(e) =>
                  setView((v) => ({ ...v, sort: e.target.value as SortKey }))
                }
              >
                <option value="board">{t("kanban.sort.board")}</option>
                <option value="priority">{t("kanban.sort.priority")}</option>
                <option value="title">{t("kanban.sort.title")}</option>
                <option value="due">{t("kanban.sort.due")}</option>
              </select>
            </label>
            <label className="kb-filter">
              <span>{t("kanban.priority")}</span>
              <select
                value={view.priority}
                onChange={(e) =>
                  setView((v) => ({
                    ...v,
                    priority: e.target.value as View["priority"],
                  }))
                }
              >
                <option value="">{t("kanban.filter.all")}</option>
                <option value="high">{t("kanban.priority.high")}</option>
                <option value="normal">{t("kanban.priority.normal")}</option>
                <option value="low">{t("kanban.priority.low")}</option>
              </select>
            </label>
            <label className="kb-filter">
              <span>{t("kanban.dueDate")}</span>
              <select
                value={view.due}
                onChange={(e) =>
                  setView((v) => ({
                    ...v,
                    due: e.target.value as DueFilter,
                  }))
                }
              >
                <option value="">{t("kanban.filter.all")}</option>
                <option value="overdue">{t("kanban.filter.overdue")}</option>
                <option value="upcoming">{t("kanban.filter.upcoming")}</option>
                <option value="none">{t("kanban.filter.noDue")}</option>
              </select>
            </label>
            <label className="kb-filter">
              <span>{t("kanban.assignees")}</span>
              <select
                value={view.assignee}
                onChange={(e) =>
                  setView((v) => ({ ...v, assignee: e.target.value }))
                }
              >
                <option value="">{t("kanban.filter.all")}</option>
                <option value="none">{t("kanban.filter.unassigned")}</option>
                {state.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="kb-filter">
              <span>{t("kanban.labels")}</span>
              <select
                value={view.label}
                onChange={(e) =>
                  setView((v) => ({ ...v, label: e.target.value }))
                }
              >
                <option value="">{t("kanban.filter.all")}</option>
                <option value="none">{t("kanban.filter.noLabels")}</option>
                {state.labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setLabelsOpen(true)}
            >
              {t("kanban.manageLabels")}
            </button>
          </div>
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
          people={state.people}
          labels={state.labels}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            if (editing.card) {
              await api.updateKanbanCard(id, editing.card.id, fields);
            } else {
              await api.addKanbanCard(id, {
                columnId: editing.columnId,
                ...fields,
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
          onCreateLabel={(name, color) =>
            api.createKanbanLabel(id, { name, color }).then((r) => r.label)
          }
        />
      )}
      {labelsOpen && (
        <KanbanLabelsDialog
          boardId={id}
          labels={state.labels}
          onClose={() => setLabelsOpen(false)}
        />
      )}
    </AppShell>
  );
}

function normalizeKanbanState(raw: KanbanState): KanbanState {
  return {
    ...raw,
    labels: raw.labels ?? [],
    people: raw.people ?? [],
    cards: (raw.cards ?? []).map((c) => ({
      ...c,
      priority:
        c.priority === "high" || c.priority === "low" ? c.priority : "normal",
      dueDate: isDueDate(c.dueDate) ? c.dueDate : null,
      assigneeIds: c.assigneeIds ?? [],
      labelIds: c.labelIds ?? [],
    })),
  };
}

function matchesView(card: KanbanCard, view: View): boolean {
  if (view.priority && card.priority !== view.priority) return false;
  if (view.due) {
    const today = localTodayIso();
    if (view.due === "none" && card.dueDate) return false;
    if (view.due === "overdue" && (!card.dueDate || card.dueDate >= today)) {
      return false;
    }
    if (view.due === "upcoming" && (!card.dueDate || card.dueDate < today)) {
      return false;
    }
  }
  if (view.assignee === "none" && card.assigneeIds.length > 0) return false;
  if (
    view.assignee &&
    view.assignee !== "none" &&
    !card.assigneeIds.includes(view.assignee)
  ) {
    return false;
  }
  if (view.label === "none" && card.labelIds.length > 0) return false;
  if (
    view.label &&
    view.label !== "none" &&
    !card.labelIds.includes(view.label)
  ) {
    return false;
  }
  return true;
}

function sortCards(cards: KanbanCard[], sort: SortKey): KanbanCard[] {
  const copy = [...cards];
  if (sort === "priority") {
    const rank = { high: 0, normal: 1, low: 2 };
    copy.sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] || a.sortOrder - b.sortOrder,
    );
  } else if (sort === "title") {
    copy.sort(
      (a, b) => a.title.localeCompare(b.title) || a.sortOrder - b.sortOrder,
    );
  } else if (sort === "due") {
    copy.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder;
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.sortOrder - b.sortOrder;
    });
  } else {
    copy.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return copy;
}

function toKitData(state: KanbanState, view: View): BoardData {
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
    const cards = sortCards(
      state.cards.filter((c) => c.columnId === col.id && matchesView(c, view)),
      view.sort,
    );
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

function KanbanCardFace({
  card,
  labels,
  people,
}: {
  card: KanbanCard;
  labels: KanbanLabel[];
  people: KanbanPerson[];
}) {
  const t = useT();
  const { locale } = useI18n();
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const assignees = people.filter((p) => card.assigneeIds.includes(p.id));
  const due = isDueDate(card.dueDate) ? card.dueDate : null;
  return (
    <div className="kb-card">
      <div className="kb-card-top">
        <span className={`kb-priority kb-priority--${card.priority}`}>
          {card.priority === "high"
            ? t("kanban.priority.high")
            : card.priority === "low"
              ? t("kanban.priority.low")
              : t("kanban.priority.normal")}
        </span>
        {due ? (
          <span className={`kb-due kb-due--${dueStatus(due)}`}>
            {formatDueDate(due, locale)}
          </span>
        ) : null}
      </div>
      <div className="kb-card-title">{card.title}</div>
      {card.description ? (
        <div className="kb-card-desc">{card.description}</div>
      ) : null}
      {cardLabels.length > 0 && (
        <div className="kb-card-labels">
          {cardLabels.map((l) => (
            <span
              key={l.id}
              className="kb-label-chip"
              style={{ background: l.color, color: labelTextColor(l.color) }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      {assignees.length > 0 && (
        <div className="kb-card-people">
          {assignees.map((p) => (
            <span key={p.id} className="kb-avatar" title={p.displayName}>
              {initials(p.displayName)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
