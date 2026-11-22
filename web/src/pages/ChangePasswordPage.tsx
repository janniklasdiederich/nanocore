import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { BrandMark } from "../components/BrandMark";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function ChangePasswordPage() {
  const { user, setSession, org, clearSession } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t("password.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setSession(res.user, org);
      if (user?.mustChangePassword) {
        navigate("/", { replace: true });
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirm("");
        setSaved(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "TEMPORARY_PASSWORD_REUSED") {
        setError(t("password.temporaryReused"));
      } else {
        setError(err instanceof ApiError ? err.message : t("password.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  if (saved) {
    return (
      <div className="center-screen">
        <section className="auth-card">
          <h1 role="status">{t("password.changed")}</h1>
          <Link to="/" replace className="btn btn-primary">{t("common.done")}</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card__lang">
          <LanguageSwitcher compact />
        </div>
        <div className="brand">
          <BrandMark />
          {org?.name || t("app.name")}
        </div>
        <h1>{t(user?.mustChangePassword ? "password.title" : "password.change")}</h1>
        <p className="subtitle">
          {user?.mustChangePassword
            ? t("password.subtitleTemp")
            : t("password.subtitleUpdate")}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="current">{t("password.current")}</label>
          <input
            id="current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label htmlFor="new">{t("password.new")}</label>
          <input
            id="new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">{t("password.confirm")}</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("password.save")}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: 10 }}
          disabled={busy}
          onClick={() => user?.mustChangePassword ? void logout() : navigate("/", { replace: true })}
        >
          {t(user?.mustChangePassword ? "common.signOut" : "common.cancel")}
        </button>
      </form>
    </div>
  );
}
