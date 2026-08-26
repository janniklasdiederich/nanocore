import type { RecurrenceFreq } from "../kanbanRecurrence";
import { useI18n, useT } from "../i18n";

const FREQS: RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

export function KanbanRepeatFields({
  freq,
  weekdays,
  until,
  onFreq,
  onWeekdays,
  onUntil,
  variant,
}: {
  freq: RecurrenceFreq | "";
  weekdays: number[];
  until: string;
  onFreq: (freq: RecurrenceFreq | "") => void;
  onWeekdays: (days: number[]) => void;
  onUntil: (until: string) => void;
  variant: "page" | "canvas";
}) {
  const t = useT();
  const { locale } = useI18n();
  const weekStart = locale === "de" ? 1 : 0;
  const labels = Array.from({ length: 7 }, (_, i) => {
    const day = (weekStart + i) % 7;
    const name = new Date(Date.UTC(2024, 0, 7 + day)).toLocaleDateString(
      locale,
      { weekday: "short", timeZone: "UTC" },
    );
    return { day, name };
  });

  function toggleDay(day: number) {
    if (weekdays.includes(day)) {
      const next = weekdays.filter((d) => d !== day);
      onWeekdays(next.length ? next : [day]);
    } else {
      onWeekdays([...weekdays, day].sort((a, b) => a - b));
    }
  }

  const selectClass = variant === "canvas" ? "nc-kb-tl-input" : undefined;
  const wrap = variant === "canvas" ? "nc-kb-tl-field" : "field";
  const labelClass = variant === "canvas" ? "nc-kb-tl-label" : undefined;

  return (
    <div className={wrap}>
      <label htmlFor="kb-repeat">
        <span className={labelClass}>{t("kanban.repeat")}</span>
      </label>
      <select
        id="kb-repeat"
        className={selectClass}
        value={freq}
        onChange={(e) => onFreq(e.target.value as RecurrenceFreq | "")}
      >
        <option value="">{t("kanban.repeat.none")}</option>
        {FREQS.map((f) => (
          <option key={f} value={f}>
            {f === "daily"
              ? t("kanban.repeat.daily")
              : f === "weekly"
                ? t("kanban.repeat.weekly")
                : f === "monthly"
                  ? t("kanban.repeat.monthly")
                  : t("kanban.repeat.yearly")}
          </option>
        ))}
      </select>
      {freq === "weekly" && (
        <div className="kb-weekdays" role="group" aria-label={t("kanban.repeat.weekdays")}>
          {labels.map(({ day, name }) => (
            <button
              key={day}
              type="button"
              className={
                "kb-weekday" + (weekdays.includes(day) ? " is-on" : "")
              }
              onClick={() => toggleDay(day)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {freq ? (
        <div className="kb-due-row" style={{ marginTop: 8 }}>
          <label className={labelClass} htmlFor="kb-repeat-until">
            {t("kanban.repeat.until")}
          </label>
          <input
            id="kb-repeat-until"
            className={selectClass}
            type="date"
            value={until}
            onChange={(e) => onUntil(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
