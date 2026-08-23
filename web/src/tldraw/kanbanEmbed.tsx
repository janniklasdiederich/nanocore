import { useRef, type ReactNode } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  stopEventPropagation,
  toDomPrecision,
  useDialogs,
  type TLBaseShape,
} from "tldraw";
import { api, type KanbanCard } from "../api";
import {
  avatarColor,
  dueDayDelta,
  dueStatus,
  formatDueDate,
  initials,
  isDueDate,
  labelTextColor,
} from "../kanbanDisplay";
import { useI18n, useT } from "../i18n";
import { KanbanCardEditDialog } from "./KanbanCardEditDialog";
import {
  DRAG_THRESHOLD,
  beginKanbanDrag,
  cancelKanbanDrag,
  endKanbanDrag,
  isKanbanDragging,
  moveKanbanDrag,
} from "./kanbanCardDrag";
import { useKanbanLive, type KanbanLive } from "./kanbanLive";

export const KANBAN_CARD_TYPE = "kanban-card" as const;
export const KANBAN_COLUMN_TYPE = "kanban-column" as const;

export const KANBAN_CARD_W = 240;
export const KANBAN_CARD_H = 110;
export const KANBAN_COLUMN_W = 260;
export const KANBAN_COLUMN_H = 420;

export type TLKanbanCardShape = TLBaseShape<
  typeof KANBAN_CARD_TYPE,
  { w: number; h: number; boardId: string; cardId: string }
>;

export type TLKanbanColumnShape = TLBaseShape<
  typeof KANBAN_COLUMN_TYPE,
  { w: number; h: number; boardId: string; columnId: string }
>;

export class KanbanCardShapeUtil extends BaseBoxShapeUtil<TLKanbanCardShape> {
  static override type = KANBAN_CARD_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    boardId: T.string,
    cardId: T.string,
  };

  override canEdit() {
    return false;
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  override hideSelectionBoundsFg() {
    return true;
  }

  getDefaultProps(): TLKanbanCardShape["props"] {
    return {
      w: KANBAN_CARD_W,
      h: KANBAN_CARD_H,
      boardId: "",
      cardId: "",
    };
  }

  component(shape: TLKanbanCardShape) {
    return <KanbanCardShape shape={shape} />;
  }

  indicator(shape: TLKanbanCardShape) {
    return (
      <rect
        width={toDomPrecision(shape.props.w)}
        height={toDomPrecision(shape.props.h)}
        rx={10}
        ry={10}
      />
    );
  }
}

export class KanbanColumnShapeUtil extends BaseBoxShapeUtil<TLKanbanColumnShape> {
  static override type = KANBAN_COLUMN_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    boardId: T.string,
    columnId: T.string,
  };

  override canEdit() {
    return false;
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  override hideSelectionBoundsFg() {
    return true;
  }

  getDefaultProps(): TLKanbanColumnShape["props"] {
    return {
      w: KANBAN_COLUMN_W,
      h: KANBAN_COLUMN_H,
      boardId: "",
      columnId: "",
    };
  }

  component(shape: TLKanbanColumnShape) {
    return <KanbanColumnShape shape={shape} />;
  }

  indicator(shape: TLKanbanColumnShape) {
    return (
      <rect
        width={toDomPrecision(shape.props.w)}
        height={toDomPrecision(shape.props.h)}
        rx={12}
        ry={12}
      />
    );
  }
}

function KanbanCardShape({ shape }: { shape: TLKanbanCardShape }) {
  const t = useT();
  const live = useKanbanLive(shape.props.boardId);
  const card = live.status === "ok"
    ? live.state.cards.find((c) => c.id === shape.props.cardId)
    : undefined;

  return (
    <HTMLContainer
      className="nc-kb-embed"
      style={{ width: shape.props.w, height: shape.props.h }}
    >
      <StatusBody live={live} missing={!card && live.status === "ok"}>
        {card && (
          <EmbedCard boardId={shape.props.boardId} card={card} />
        )}
        {live.status === "ok" && !card && (
          <div className="nc-kb-embed-status">{t("kanbanEmbed.missingCard")}</div>
        )}
      </StatusBody>
    </HTMLContainer>
  );
}

function KanbanColumnShape({ shape }: { shape: TLKanbanColumnShape }) {
  const t = useT();
  const live = useKanbanLive(shape.props.boardId);
  const column =
    live.status === "ok"
      ? live.state.columns.find((c) => c.id === shape.props.columnId)
      : undefined;
  const cards =
    live.status === "ok" && column
      ? live.state.cards
          .filter((c) => c.columnId === column.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

  return (
    <HTMLContainer
      className="nc-kb-embed nc-kb-embed--column"
      style={{ width: shape.props.w, height: shape.props.h }}
    >
      <StatusBody live={live} missing={!column && live.status === "ok"}>
        {column && live.status === "ok" && (
          <>
            <div className="nc-kb-embed-col-head">
              <strong>{column.title}</strong>
              <span className="nc-kb-embed-count">{cards.length}</span>
            </div>
            <div className="nc-kb-embed-col-board">{live.state.board.name}</div>
            <div
              className="nc-kb-embed-col-list"
              data-nc-kb-drop=""
              data-nc-kb-board={shape.props.boardId}
              data-nc-kb-column={column.id}
              onWheel={stopEventPropagation}
            >
              {cards.length === 0 && (
                <div className="nc-kb-embed-status">
                  {t("kanbanEmbed.emptyColumn")}
                </div>
              )}
              {cards.map((card) => (
                <EmbedCard
                  key={card.id}
                  boardId={shape.props.boardId}
                  card={card}
                />
              ))}
            </div>
          </>
        )}
        {live.status === "ok" && !column && (
          <div className="nc-kb-embed-status">
            {t("kanbanEmbed.missingColumn")}
          </div>
        )}
      </StatusBody>
    </HTMLContainer>
  );
}

function EmbedCard({
  boardId,
  card,
}: {
  boardId: string;
  card: KanbanCard;
}) {
  const t = useT();
  const { locale } = useI18n();
  const live = useKanbanLive(boardId);
  const { addDialog } = useDialogs();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const labels =
    live.status === "ok"
      ? live.state.labels.filter((l) => (card.labelIds ?? []).includes(l.id))
      : [];
  const people =
    live.status === "ok"
      ? live.state.people.filter((p) => (card.assigneeIds ?? []).includes(p.id))
      : [];
  const showPriority = card.priority === "high" || card.priority === "low";
  const due = isDueDate(card.dueDate) ? card.dueDate : null;
  const showFoot = Boolean(due) || people.length > 0;

  function openEdit() {
    addDialog({
      component: (props) => (
        <KanbanCardEditDialog {...props} boardId={boardId} card={card} />
      ),
    });
  }

  return (
    <button
      type="button"
      className={
        "nc-kb-embed-card" +
        (card.priority === "high" ? " nc-kb-embed-card--high" : "")
      }
      data-nc-kb-card={card.id}
      onPointerDown={(e) => {
        stopEventPropagation(e);
        if (e.button !== 0) return;
        origin.current = { x: e.clientX, y: e.clientY };
        const start = origin.current;
        const onMove = (ev: PointerEvent) => {
          const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
          if (!isKanbanDragging()) {
            if (dist < DRAG_THRESHOLD) return;
            beginKanbanDrag({ boardId, card }, ev.clientX, ev.clientY);
          }
          moveKanbanDrag(ev.clientX, ev.clientY);
        };
        const onUp = (ev: PointerEvent) => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          origin.current = null;
          if (!isKanbanDragging()) {
            openEdit();
            return;
          }
          const drop = endKanbanDrag(ev.clientX, ev.clientY);
          if (!drop) return;
          void api.moveKanbanCard(drop.boardId, card.id, {
            columnId: drop.columnId,
            index: drop.index,
          });
        };
        const onCancel = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          origin.current = null;
          cancelKanbanDrag();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
      }}
    >
      {(labels.length > 0 || showPriority) && (
        <div className="nc-kb-embed-meta">
          {labels.map((l) => (
            <span
              key={l.id}
              className="nc-kb-chip"
              style={{ background: l.color, color: labelTextColor(l.color) }}
            >
              {l.name}
            </span>
          ))}
          {showPriority ? (
            <span className={`nc-kb-priority nc-kb-priority--${card.priority}`}>
              {card.priority === "high"
                ? t("kanban.priority.high")
                : t("kanban.priority.low")}
            </span>
          ) : null}
        </div>
      )}
      <div className="nc-kb-embed-card-title">{card.title}</div>
      {card.description ? (
        <div className="nc-kb-embed-card-desc">{card.description}</div>
      ) : null}
      {showFoot ? (
        <div className="nc-kb-embed-foot">
          {due ? (
            <span
              className={`nc-kb-due nc-kb-due--${dueStatus(due)}`}
              title={formatDueDate(due, locale)}
            >
              {embedDueText(due, locale, t)}
            </span>
          ) : (
            <span />
          )}
          {people.length > 0 ? (
            <div className="nc-kb-embed-people">
              {people.map((p) => (
                <span
                  key={p.id}
                  className="nc-kb-avatar"
                  title={p.displayName}
                  style={{ background: avatarColor(p.id) }}
                >
                  {initials(p.displayName)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function embedDueText(
  due: string,
  locale: string,
  t: ReturnType<typeof useT>,
): string {
  const delta = dueDayDelta(due);
  if (delta === 0) return t("kanban.due.today");
  if (delta === 1) return t("kanban.due.tomorrow");
  if (delta === -1) return t("kanban.due.yesterday");
  return formatDueDate(due, locale);
}

function StatusBody({
  live,
  missing,
  children,
}: {
  live: KanbanLive;
  missing: boolean;
  children: ReactNode;
}) {
  const t = useT();
  if (live.status === "loading" || live.status === "idle") {
    return <div className="nc-kb-embed-status">{t("kanbanEmbed.loading")}</div>;
  }
  if (live.status === "forbidden") {
    return <div className="nc-kb-embed-status">{t("kanbanEmbed.noAccess")}</div>;
  }
  if (live.status === "error") {
    return (
      <div className="nc-kb-embed-status">
        {t("kanbanEmbed.error", { message: live.message })}
      </div>
    );
  }
  if (missing) return <>{children}</>;
  return <>{children}</>;
}
