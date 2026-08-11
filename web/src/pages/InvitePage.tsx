import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type InvitePreview } from "../api";
import { useAuth } from "../auth";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n, useT } from "../i18n";

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { setSession, user, setupComplete } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError(t("invite.invalidTitle"));
      setLoading(false);
      return;
    }
    void api
      .previewInvite(token)
      .then((p) => {
        setPreview(p);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          // 410 returns body with details via request() — only message available
          setPreview({
            valid: false,
            org: null,
            error: err.message,
            code: err.code,
          });
        } else {
          setLoadError(t("invite.invalidTitle"));
        }
      })
      .finally(() => setLoading(false));
  }, [token, t]);

  // Already signed in → boards
  useEffect(() => {
    if (user && !user.mustChangePassword) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.acceptInvite(token, {
        email,
        password,
        displayName: displayName || undefined,
      });
      setSession(res.user, res.org);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("invite.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!setupComplete) {
    return <Link to="/setup" />;
  }

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const invalid =
    loadError || !preview || preview.valid === false || !token;

  if (invalid) {
    return (
      <div className="center-screen">
        <div className="auth-card">
          <div className="auth-card__lang">
            <LanguageSwitcher compact />
          </div>
          <div className="brand">
            <span className="brand-mark" aria-hidden />
            {preview?.org?.name || t("app.name")}
          </div>
          <h1>{t("invite.invalidTitle")}</h1>
          <p className="subtitle">
            {preview?.error || loadError || t("invite.invalidHelp")}
          </p>
          {!preview?.error && (
            <p className="subtitle">{t("invite.invalidHelp")}</p>
          )}
          <Link className="btn btn-primary" to="/login">
            {t("invite.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  const orgName = preview.org?.name || t("app.name");
  const dateLocale = locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card__lang">
          <LanguageSwitcher compact />
        </div>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          {orgName}
        </div>
        <h1>{t("invite.joinTitle", { org: orgName })}</h1>
        <p className="subtitle">{t("invite.joinSubtitle")}</p>
        {preview.expiresAt && (
          <p className="subtitle" style={{ marginTop: -12 }}>
            {t("invite.expiresOn", {
              date: new Date(preview.expiresAt).toLocaleString(dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
        {preview.remainingUses != null ? (
          <p className="subtitle" style={{ marginTop: -8 }}>
            {t("invite.remaining", { count: preview.remainingUses })}
          </p>
        ) : (
          <p className="subtitle" style={{ marginTop: -8 }}>
            {t("invite.unlimited")}
          </p>
        )}

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="inv-name">{t("invite.displayName")}</label>
          <input
            id="inv-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="inv-email">{t("invite.email")}</label>
          <input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="inv-pass">{t("invite.password")}</label>
          <input
            id="inv-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t("invite.submitting") : t("invite.submit")}
        </button>
        <p style={{ marginTop: 14, textAlign: "center" }}>
          <Link to="/login">{t("invite.goLogin")}</Link>
        </p>
      </form>
    </div>
  );
}
