export const RECURRENCE_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const COLUMN_ROLES = [
  "normal",
  "recurring_open",
  "recurring_progress",
  "recurring_done",
] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export const RECURRING_ROLES = [
  "recurring_open",
  "recurring_progress",
  "recurring_done",
] as const;
export type RecurringRole = (typeof RECURRING_ROLES)[number];

export const RECURRING_COLUMN_DEFAULTS: {
  role: RecurringRole;
  title: string;
}[] = [
  { role: "recurring_open", title: "Recurring: Open" },
  { role: "recurring_progress", title: "Recurring: In Progress" },
  { role: "recurring_done", title: "Recurring: Done" },
];

export type KanbanRecurrence = {
  freq: RecurrenceFreq;
  weekdays: number[];
  day: number | null;
  month: number | null;
  until: string | null;
};

const DUE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DUE.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function todayIso(): string {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth(), n.getDate());
}

export function toIso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parts(iso: string): { y: number; m: number; d: number } {
  return {
    y: Number(iso.slice(0, 4)),
    m: Number(iso.slice(5, 7)) - 1,
    d: Number(iso.slice(8, 10)),
  };
}

function clampMonthDay(y: number, m0: number, day: number): string {
  const last = new Date(y, m0 + 1, 0).getDate();
  return toIso(y, m0, Math.min(Math.max(1, day), last));
}

export function isRecurringRole(role: string | null | undefined): boolean {
  return (
    role === "recurring_open" ||
    role === "recurring_progress" ||
    role === "recurring_done"
  );
}

export function parseRecurrence(value: unknown): KanbanRecurrence | null {
  if (value == null || value === "") return null;
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  if (!RECURRENCE_FREQS.includes(rec.freq as RecurrenceFreq)) return null;
  const freq = rec.freq as RecurrenceFreq;
  let weekdays: number[] = [];
  if (freq === "weekly") {
    const w = rec.weekdays;
    if (!Array.isArray(w)) return null;
    weekdays = [
      ...new Set(
        w.filter(
          (n): n is number =>
            typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6,
        ),
      ),
    ].sort((a, b) => a - b);
    if (weekdays.length === 0) return null;
  }
  let day: number | null = null;
  if (typeof rec.day === "number" && rec.day >= 1 && rec.day <= 31) {
    day = Math.floor(rec.day);
  }
  let month: number | null = null;
  if (typeof rec.month === "number" && rec.month >= 1 && rec.month <= 12) {
    month = Math.floor(rec.month);
  }
  if (freq === "monthly" && day == null) return null;
  if (freq === "yearly" && (day == null || month == null)) return null;
  const until =
    rec.until == null || rec.until === ""
      ? null
      : isIsoDate(rec.until)
        ? rec.until
        : null;
  if (rec.until != null && rec.until !== "" && !until) return null;
  return { freq, weekdays, day, month, until };
}

export function lastOccurrenceOnOrBefore(
  today: string,
  rec: KanbanRecurrence,
): string | null {
  const cap = rec.until && today > rec.until ? rec.until : today;
  const t = parts(cap);
  if (rec.freq === "daily") return cap;
  if (rec.freq === "weekly") {
    for (let i = 0; i < 7; i++) {
      const x = new Date(t.y, t.m, t.d - i);
      if (rec.weekdays.includes(x.getDay())) {
        return toIso(x.getFullYear(), x.getMonth(), x.getDate());
      }
    }
    return null;
  }
  if (rec.freq === "monthly") {
    const day = rec.day ?? t.d;
    const thisMonth = clampMonthDay(t.y, t.m, day);
    if (thisMonth <= cap) return thisMonth;
    const py = t.m === 0 ? t.y - 1 : t.y;
    const pm = t.m === 0 ? 11 : t.m - 1;
    return clampMonthDay(py, pm, day);
  }
  const month0 = (rec.month ?? t.m + 1) - 1;
  const day = rec.day ?? t.d;
  const thisYear = clampMonthDay(t.y, month0, day);
  if (thisYear <= cap) return thisYear;
  return clampMonthDay(t.y - 1, month0, day);
}

export function recurrenceMatchesDate(
  rec: KanbanRecurrence,
  iso: string,
): boolean {
  if (rec.until && iso > rec.until) return false;
  return lastOccurrenceOnOrBefore(iso, rec) === iso;
}

export function defaultWeeklyRecurrence(from = todayIso()): KanbanRecurrence {
  const { y, m, d } = parts(from);
  const weekday = new Date(y, m, d).getDay();
  return {
    freq: "weekly",
    weekdays: [weekday],
    day: null,
    month: null,
    until: null,
  };
}
