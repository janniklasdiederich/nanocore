export const KANBAN_PRIORITIES = ["high", "normal", "low"] as const;
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];

export const KANBAN_LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase() || "?";
}

const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !DUE_DATE.test(value)) return false;
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

export function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DueStatus = "overdue" | "today" | "upcoming";

export function dueStatus(dueDate: string, today = localTodayIso()): DueStatus {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

export function dueDayDelta(dueDate: string, today = localTodayIso()): number {
  const a = Date.UTC(
    Number(dueDate.slice(0, 4)),
    Number(dueDate.slice(5, 7)) - 1,
    Number(dueDate.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return Math.round((a - b) / 86_400_000);
}

export function formatDueDate(dueDate: string, locale: string): string {
  const y = Number(dueDate.slice(0, 4));
  const m = Number(dueDate.slice(5, 7));
  const d = Number(dueDate.slice(8, 10));
  const thisYear = new Date().getFullYear() === y;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  });
}

export function avatarColor(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (
    KANBAN_LABEL_COLORS[Math.abs(hash) % KANBAN_LABEL_COLORS.length] ?? "#3b82f6"
  );
}

export function formatStamp(iso: string, locale: string): string {
  const date = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function labelTextColor(hex: string): "#111" | "#fff" {
  const raw = hex.replace("#", "");
  if (raw.length < 6) return "#fff";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 160 ? "#111" : "#fff";
}
