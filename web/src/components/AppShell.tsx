import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import type { ReactNode } from "react";

export function AppShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { user, org, clearSession } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await api.logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand" style={{ margin: 0 }}>
            <span className="brand-mark" aria-hidden />
            <span className="topbar-title">{org?.name || "Nanocore"}</span>
          </Link>
          {title && <span className="topbar-meta">/ {title}</span>}
        </div>
        <div className="topbar-actions">
          <span className="topbar-meta">
            {user?.displayName}
            {user?.role === "admin" ? " · admin" : ""}
          </span>
          {user?.role === "admin" && (
            <Link className="btn btn-secondary btn-sm" to="/users">
              Users
            </Link>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
