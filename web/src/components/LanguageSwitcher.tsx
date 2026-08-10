import { useI18n, type Locale } from "../i18n";

export function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={compact ? "lang-switch lang-switch--compact" : "lang-switch"}>
      {!compact && (
        <span className="lang-switch__label">{t("common.language")}</span>
      )}
      <select
        className="lang-switch__select"
        value={locale}
        aria-label={t("common.language")}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="en">{t("common.english")}</option>
        <option value="de">{t("common.german")}</option>
      </select>
    </label>
  );
}
