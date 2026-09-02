import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppShell({
  title,
  wide = false,
  children,
}: {
  title?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const { user, org, clearSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  useDocumentTitle(title);
  const isAdmin = user?.role === "admin";

  async function logout() {
    await api.logout();
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className={wide ? "app-shell app-shell--wide" : "app-shell"}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <span className="sidebar-org">{org?.name || t("app.name")}</span>
        </div>
        <nav className="sidebar-nav" aria-label={t("nav.main")}>
          <NavLink to="/" end className={navClass}>
            {t("nav.whiteboards")}
          </NavLink>
          <NavLink to="/kanban" className={navClass}>
            {t("nav.kanban")}
          </NavLink>
          <NavLink
            to="/spaces"
            className={({ isActive }) =>
              navClass({
                isActive:
                  isActive || location.pathname.startsWith("/docs"),
              })
            }
          >
            {t("nav.documents")}
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              {t("nav.admin")}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitcher compact />
          <div className="sidebar-user">
            {user?.displayName}
            {isAdmin ? ` · ${t("common.admin")}` : ""}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void logout()}
          >
            {t("common.signOut")}
          </button>
        </div>
      </aside>
      <div className="app-shell-main">
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "sidebar-link sidebar-link--active" : "sidebar-link";
}
