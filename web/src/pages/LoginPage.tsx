import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function LoginPage() {
  const { setSession, org } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.login(email, password);
      setSession(res.user, res.org);
      navigate(res.user.mustChangePassword ? "/change-password" : "/", {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
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
          {org?.name || t("app.name")}
        </div>
        <h1>{t("login.title")}</h1>
        <p className="subtitle">{t("login.subtitle")}</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="email">{t("login.email")}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t("login.password")}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("login.signingIn") : t("login.submit")}
        </button>
      </form>
    </div>
  );
}
