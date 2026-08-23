import { useMemo, useState } from "react";
import type { KanbanCard } from "../api";
import { dueStatus, isDueDate, localTodayIso } from "../kanbanDisplay";
import { useI18n, useT } from "../i18n";

type Cursor = { y: number; m: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

function nowCursor(): Cursor {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() };
}

function shiftMonth(cursor: Cursor, delta: number): Cursor {
  const d = new Date(cursor.y, cursor.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function weekStartFor(locale: string): number {
  return locale === "de" ? 1 : 0;
}

function weekdayLabels(locale: string, weekStart: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(2024, 0, 7 + weekStart + i));
    return day.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  });
}

type Cell = { iso: string; inMonth: boolean; day: number };

function monthCells(cursor: Cursor, weekStart: number): Cell[] {
  const { y, m } = cursor;
  const firstDow = new Date(y, m, 1).getDay();
  const lead = (firstDow - weekStart + 7) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells: Cell[] = [];

  for (let i = lead; i > 0; i--) {
    const d = prevDays - i + 1;
    const dt = new Date(y, m - 1, d);
    cells.push({
      iso: toIso(dt.getFullYear(), dt.getMonth(), d),
      inMonth: false,
      day: d,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toIso(y, m, d), inMonth: true, day: d });
  }
  let next = 1;
  while (cells.length < 42) {
    const dt = new Date(y, m + 1, next);
    cells.push({
      iso: toIso(dt.getFullYear(), dt.getMonth(), next),
      inMonth: false,
      day: next,
    });
    next += 1;
  }
  return cells;
}

export function KanbanCalendar({
  cards,
  onOpenCard,
}: {
  cards: KanbanCard[];
  onOpenCard: (card: KanbanCard) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [cursor, setCursor] = useState<Cursor>(nowCursor);
  const today = localTodayIso();
  const weekStart = weekStartFor(locale);
  const cells = useMemo(
    () => monthCells(cursor, weekStart),
    [cursor, weekStart],
  );
  const heads = useMemo(
    () => weekdayLabels(locale, weekStart),
    [locale, weekStart],
  );

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, KanbanCard[]>();
    const undated: KanbanCard[] = [];
    for (const card of cards) {
      if (!isDueDate(card.dueDate)) {
        undated.push(card);
        continue;
      }
      const list = byDay.get(card.dueDate) ?? [];
      list.push(card);
      byDay.set(card.dueDate, list);
    }
    for (const list of byDay.values()) {
      list.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
      );
    }
    undated.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
    );
    return { byDay, undated };
  }, [cards]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(
    locale,
    { month: "long", year: "numeric" },
  );
  const showingThisMonth =
    cursor.y === new Date().getFullYear() && cursor.m === new Date().getMonth();

  return (
    <div className="kb-cal">
      <div className="kb-cal-nav">
        <button
          type="button"
          className="kb-icon-btn"
          title={t("kanban.calendar.prev")}
          onClick={() => setCursor((c) => shiftMonth(c, -1))}
        >
          ‹
        </button>
        <h2 className="kb-cal-month">{monthLabel}</h2>
        <button
          type="button"
          className="kb-icon-btn"
          title={t("kanban.calendar.next")}
          onClick={() => setCursor((c) => shiftMonth(c, 1))}
        >
          ›
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={showingThisMonth}
          onClick={() => setCursor(nowCursor())}
        >
          {t("kanban.calendar.today")}
        </button>
      </div>
      <div className="kb-cal-weekdays">
        {heads.map((name, i) => (
          <div key={i} className="kb-cal-wd">
            {name}
          </div>
        ))}
      </div>
      <div className="kb-cal-days">
        {cells.map((cell) => {
          const dayCards = byDay.get(cell.iso) ?? [];
          const isToday = cell.iso === today;
          return (
            <div
              key={cell.iso}
              className={
                "kb-cal-day" +
                (cell.inMonth ? "" : " is-out") +
                (isToday ? " is-today" : "")
              }
            >
              <span className="kb-cal-day-num">{cell.day}</span>
              <div className="kb-cal-day-cards">
                {dayCards.map((card) => (
                  <CalChip
                    key={card.id}
                    card={card}
                    onOpen={() => onOpenCard(card)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className="kb-cal-undated">
          <div className="kb-cal-undated-head">
            <span>{t("kanban.calendar.undated")}</span>
            <span className="kb-col-count">{undated.length}</span>
          </div>
          <div className="kb-cal-undated-list">
            {undated.map((card) => (
              <CalChip
                key={card.id}
                card={card}
                onOpen={() => onOpenCard(card)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalChip({
  card,
  onOpen,
}: {
  card: KanbanCard;
  onOpen: () => void;
}) {
  const due = isDueDate(card.dueDate) ? card.dueDate : null;
  const overdue = due ? dueStatus(due) === "overdue" : false;
  return (
    <button
      type="button"
      className={
        "kb-cal-chip" +
        (card.priority === "high" ? " kb-cal-chip--high" : "") +
        (overdue ? " kb-cal-chip--overdue" : "")
      }
      title={card.title}
      onClick={onOpen}
    >
      {card.title}
    </button>
  );
}
