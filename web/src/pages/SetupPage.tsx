import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function SetupPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.setup({
        orgName,
        email,
        password,
        displayName: displayName || undefined,
      });
      setSession(res.user, res.org);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("setup.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card__lang">
          <LanguageSwitcher compact />
        </div>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          {t("app.name")}
        </div>
        <h1>{t("setup.title")}</h1>
        <p className="subtitle">{t("setup.subtitle")}</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="orgName">{t("setup.orgName")}</label>
          <input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={t("setup.orgNamePlaceholder")}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="displayName">{t("setup.displayName")}</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("setup.displayNamePlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="email">{t("setup.adminEmail")}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("setup.emailPlaceholder")}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t("setup.password")}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("common.creating") : t("setup.submit")}
        </button>
      </form>
    </div>
  );
}
