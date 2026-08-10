import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";

export function ChangePasswordPage() {
  const { user, setSession, org, clearSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setSession(res.user, org);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          {org?.name || "Nanocore"}
        </div>
        <h1>Choose a new password</h1>
        <p className="subtitle">
          {user?.mustChangePassword
            ? "Your admin set a temporary password. Pick a new one to continue."
            : "Update your password."}
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label htmlFor="current">Current password</label>
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
          <label htmlFor="new">New password (min 8 characters)</label>
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
          <label htmlFor="confirm">Confirm new password</label>
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
          {busy ? "Saving…" : "Save password"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
