import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { BoardsPage } from "./pages/BoardsPage";
import { BoardPage } from "./pages/BoardPage";
import { UsersPage } from "./pages/UsersPage";
import { InvitePage } from "./pages/InvitePage";
import { KanbanListPage } from "./pages/KanbanListPage";
import { KanbanBoardPage } from "./pages/KanbanBoardPage";
import { useOrgFavicon } from "./components/BrandMark";

function Guard({
  children,
  needAuth = true,
  allowPasswordChange = false,
  adminOnly = false,
}: {
  children: React.ReactNode;
  needAuth?: boolean;
  allowPasswordChange?: boolean;
  adminOnly?: boolean;
}) {
  const { loading, setupComplete, user } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!setupComplete) {
    return <Navigate to="/setup" replace />;
  }

  if (needAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { loading, setupComplete, user } = useAuth();
  useOrgFavicon();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/setup"
        element={
          setupComplete ? <Navigate to="/" replace /> : <SetupPage />
        }
      />
      <Route
        path="/login"
        element={
          !setupComplete ? (
            <Navigate to="/setup" replace />
          ) : user && !user.mustChangePassword ? (
            <Navigate to="/" replace />
          ) : user?.mustChangePassword ? (
            <Navigate to="/change-password" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/change-password"
        element={
          <Guard allowPasswordChange>
            <ChangePasswordPage />
          </Guard>
        }
      />
      <Route
        path="/"
        element={
          <Guard>
            <BoardsPage />
          </Guard>
        }
      />
      <Route
        path="/boards/:id"
        element={
          <Guard>
            <BoardPage />
          </Guard>
        }
      />
      <Route
        path="/kanban"
        element={
          <Guard>
            <KanbanListPage />
          </Guard>
        }
      />
      <Route
        path="/kanban/:id"
        element={
          <Guard>
            <KanbanBoardPage />
          </Guard>
        }
      />
      <Route
        path="/admin"
        element={
          <Guard adminOnly>
            <UsersPage />
          </Guard>
        }
      />
      <Route path="/users" element={<Navigate to="/admin" replace />} />
      <Route
        path="/invite/:token"
        element={
          !setupComplete ? (
            <Navigate to="/setup" replace />
          ) : (
            <InvitePage />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
