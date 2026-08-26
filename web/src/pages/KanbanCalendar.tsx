import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { KanbanCard } from "../api";
import { dueStatus, isDueDate, localTodayIso } from "../kanbanDisplay";
import { parseRecurrence, recurrenceMatchesDate } from "../kanbanRecurrence";
import { useI18n, useT } from "../i18n";

type Cursor = { y: number; m: number; d: number };
type CalRange = "day" | "week" | "month";
type Cell = { iso: string; inMonth: boolean; day: number; weekend: boolean };

const MONTH_CHIP_CAP = 3;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

function cursorIso(c: Cursor): string {
  return toIso(c.y, c.m, c.d);
}

function fromIso(iso: string): Cursor {
  return {
    y: Number(iso.slice(0, 4)),
    m: Number(iso.slice(5, 7)) - 1,
    d: Number(iso.slice(8, 10)),
  };
}

function nowCursor(): Cursor {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

function addDays(c: Cursor, n: number): Cursor {
  const d = new Date(c.y, c.m, c.d + n);
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

function addMonths(c: Cursor, n: number): Cursor {
  const d = new Date(c.y, c.m + n, 1);
  const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { y: d.getFullYear(), m: d.getMonth(), d: Math.min(c.d, max) };
}

function weekStartFor(locale: string): number {
  return locale === "de" ? 1 : 0;
}

function parseRange(raw: string | null): CalRange {
  if (raw === "day" || raw === "week") return raw;
  return "month";
}

function weekdayLabels(locale: string, weekStart: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(2024, 0, 7 + weekStart + i));
    return day.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  });
}

function makeCell(dt: Date, inMonth: boolean): Cell {
  const day = dt.getDate();
  const dow = dt.getDay();
  return {
    iso: toIso(dt.getFullYear(), dt.getMonth(), day),
    inMonth,
    day,
    weekend: dow === 0 || dow === 6,
  };
}

function monthCells(cursor: Cursor, weekStart: number): Cell[] {
  const { y, m } = cursor;
  const firstDow = new Date(y, m, 1).getDay();
  const lead = (firstDow - weekStart + 7) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: Cell[] = [];

  for (let i = lead; i > 0; i--) {
    cells.push(makeCell(new Date(y, m, 1 - i), false));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(makeCell(new Date(y, m, d), true));
  }
  let next = 1;
  while (cells.length < 42) {
    cells.push(makeCell(new Date(y, m + 1, next), false));
    next += 1;
  }
  return cells;
}

function weekCells(cursor: Cursor, weekStart: number): Cell[] {
  const dow = new Date(cursor.y, cursor.m, cursor.d).getDay();
  const lead = (dow - weekStart + 7) % 7;
  const start = new Date(cursor.y, cursor.m, cursor.d - lead);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    return makeCell(dt, dt.getMonth() === cursor.m);
  });
}

function rangeLabel(
  range: CalRange,
  cursor: Cursor,
  week: Cell[],
  locale: string,
): string {
  if (range === "day") {
    return new Date(cursor.y, cursor.m, cursor.d).toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (range === "week") {
    const a = fromIso(week[0]!.iso);
    const b = fromIso(week[6]!.iso);
    const sameYear = a.y === b.y;
    const sameMonth = sameYear && a.m === b.m;
    const left = new Date(a.y, a.m, a.d).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
    const right = new Date(b.y, b.m, b.d).toLocaleDateString(locale, {
      month: sameMonth ? undefined : "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }
  return new Date(cursor.y, cursor.m, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
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
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get("cal"));
  const [cursor, setCursor] = useState<Cursor>(nowCursor);
  const today = localTodayIso();
  const weekStart = weekStartFor(locale);
  const week = useMemo(
    () => weekCells(cursor, weekStart),
    [cursor, weekStart],
  );
  const month = useMemo(
    () => monthCells(cursor, weekStart),
    [cursor, weekStart],
  );
  const heads = useMemo(
    () => weekdayLabels(locale, weekStart),
    [locale, weekStart],
  );

  const cells =
    range === "day"
      ? [makeCell(new Date(cursor.y, cursor.m, cursor.d), true)]
      : range === "week"
        ? week
        : month;

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, KanbanCard[]>();
    const undated: KanbanCard[] = [];
    const visible = cells.map((c) => c.iso);
    function add(iso: string, card: KanbanCard) {
      const list = byDay.get(iso) ?? [];
      if (list.some((x) => x.id === card.id)) return;
      list.push(card);
      byDay.set(iso, list);
    }
    for (const card of cards) {
      const rec = parseRecurrence(card.recurrence);
      if (rec) {
        for (const iso of visible) {
          if (recurrenceMatchesDate(rec, iso)) add(iso, card);
        }
        continue;
      }
      if (isDueDate(card.dueDate)) add(card.dueDate, card);
      else undated.push(card);
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
  }, [cards, cells]);

  const showingToday =
    range === "day"
      ? cursorIso(cursor) === today
      : range === "week"
        ? week.some((c) => c.iso === today)
        : cursor.y === new Date().getFullYear() &&
          cursor.m === new Date().getMonth();

  function setRange(next: CalRange) {
    const p = new URLSearchParams(params);
    if (next === "month") p.delete("cal");
    else p.set("cal", next);
    setParams(p, { replace: true });
  }

  function step(delta: number) {
    if (range === "day") setCursor((c) => addDays(c, delta));
    else if (range === "week") setCursor((c) => addDays(c, delta * 7));
    else setCursor((c) => addMonths(c, delta));
  }

  function goToDay(iso: string) {
    setCursor(fromIso(iso));
    const p = new URLSearchParams(params);
    p.set("cal", "day");
    setParams(p, { replace: true });
  }

  return (
    <div className="kb-cal">
      <div className="kb-cal-nav">
        <div
          className="kb-view-switch"
          role="tablist"
          aria-label={t("kanban.calendar.range")}
        >
          {(["day", "week", "month"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              className={range === key ? "is-on" : ""}
              onClick={() => setRange(key)}
            >
              {key === "day"
                ? t("kanban.calendar.range.day")
                : key === "week"
                  ? t("kanban.calendar.range.week")
                  : t("kanban.calendar.range.month")}
            </button>
          ))}
        </div>
        <div className="kb-cal-nav-title">
          <button
            type="button"
            className="kb-icon-btn"
            title={t("kanban.calendar.prev")}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <h2 className="kb-cal-month">
            {rangeLabel(range, cursor, week, locale)}
          </h2>
          <button
            type="button"
            className="kb-icon-btn"
            title={t("kanban.calendar.next")}
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={showingToday}
          onClick={() => setCursor(nowCursor())}
        >
          {t("kanban.calendar.today")}
        </button>
      </div>
      <div className={"kb-cal-sheet kb-cal-sheet--" + range}>
        {range !== "day" && (
          <div className="kb-cal-weekdays">
            {heads.map((name, i) => (
              <div key={i} className="kb-cal-wd">
                {name}
              </div>
            ))}
          </div>
        )}
        <div
          className={
            "kb-cal-days" +
            (range === "week" ? " kb-cal-days--week" : "") +
            (range === "day" ? " kb-cal-days--day" : "")
          }
        >
          {cells.map((cell) => {
            const dayCards = byDay.get(cell.iso) ?? [];
            const isToday = cell.iso === today;
            const cap = range === "month" ? MONTH_CHIP_CAP : Infinity;
            const extra =
              dayCards.length > cap ? dayCards.length - cap : 0;
            const shown = extra ? dayCards.slice(0, cap) : dayCards;
            return (
              <div
                key={cell.iso}
                className={
                  "kb-cal-day" +
                  (cell.inMonth ? "" : " is-out") +
                  (isToday ? " is-today" : "") +
                  (cell.weekend ? " is-weekend" : "")
                }
                onClick={
                  range === "day" ? undefined : () => goToDay(cell.iso)
                }
              >
                {range === "day" ? (
                  <span className="kb-cal-day-num">
                    {new Date(cursor.y, cursor.m, cursor.d).toLocaleDateString(
                      locale,
                      { weekday: "long" },
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="kb-cal-day-num"
                    title={t("kanban.calendar.openDay")}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToDay(cell.iso);
                    }}
                  >
                    {cell.day}
                  </button>
                )}
                <div className="kb-cal-day-cards">
                  {dayCards.length === 0 && range === "day" ? (
                    <p className="kb-cal-empty">
                      {t("kanban.calendar.emptyDay")}
                    </p>
                  ) : (
                    <>
                      {shown.map((card) => (
                        <CalChip
                          key={card.id}
                          card={card}
                          detail={range === "day"}
                          onOpen={() => onOpenCard(card)}
                        />
                      ))}
                      {extra > 0 ? (
                        <button
                          type="button"
                          className="kb-cal-more"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToDay(cell.iso);
                          }}
                        >
                          {t("kanban.calendar.more", { count: extra })}
                        </button>
                      ) : null}
                    </>
                  )}
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
    </div>
  );
}

function CalChip({
  card,
  detail,
  onOpen,
}: {
  card: KanbanCard;
  detail?: boolean;
  onOpen: () => void;
}) {
  const due = isDueDate(card.dueDate) ? card.dueDate : null;
  const overdue = due ? dueStatus(due) === "overdue" : false;
  return (
    <button
      type="button"
      className={
        "kb-cal-chip" +
        (detail ? " kb-cal-chip--detail" : "") +
        (card.priority === "high" ? " kb-cal-chip--high" : "") +
        (overdue ? " kb-cal-chip--overdue" : "")
      }
      title={card.title}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="kb-cal-chip-title">{card.title}</span>
      {detail && card.description ? (
        <span className="kb-cal-chip-desc">{card.description}</span>
      ) : null}
    </button>
  );
}
