import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export function SetupPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
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
      setError(err instanceof ApiError ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          Nanocore
        </div>
        <h1>Welcome — set up your workspace</h1>
        <p className="subtitle">
          Create your organization and the first admin account. You can invite
          people after this.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="orgName">Organization / team name</label>
          <input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Design"
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="displayName">Your display name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </div>
        <div className="field">
          <label htmlFor="email">Admin email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password (min 8 characters)</label>
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
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
