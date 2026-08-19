import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type Board } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useI18n, useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { BoardAccessDialog } from "./BoardAccessDialog";

export function BoardsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [boards, setBoards] = useState<Board[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState<Board | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listBoards();
      setBoards(res.boards);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("boards.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useDocumentTitle(t("boards.title"));

  async function createBoard() {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const res = await api.createBoard(t("boards.defaultName"));
      navigate(`/boards/${res.board.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("boards.createFailed"),
      );
      setCreating(false);
    }
  }

  async function renameBoard(board: Board) {
    if (!isAdmin) return;
    const name = window.prompt(t("boards.renamePrompt"), board.name);
    if (!name || name.trim() === board.name) return;
    try {
      const res = await api.renameBoard(board.id, name.trim());
      setBoards((prev) =>
        prev.map((b) => (b.id === board.id ? res.board : b)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("boards.renameFailed"),
      );
    }
  }

  async function removeBoard(board: Board) {
    if (!isAdmin) return;
    if (
      !window.confirm(t("boards.deleteConfirm", { name: board.name }))
    ) {
      return;
    }
    try {
      await api.deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("boards.deleteFailed"),
      );
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>{t("boards.title")}</h1>
          <p>{t("boards.subtitle")}</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={creating}
            onClick={() => void createBoard()}
          >
            {creating ? t("boards.creating") : t("boards.new")}
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-screen" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <p>{isAdmin ? t("boards.empty") : t("boards.emptyMember")}</p>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "auto", marginTop: 12 }}
              onClick={() => void createBoard()}
            >
              {t("boards.createFirst")}
            </button>
          )}
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <article key={board.id} className="board-card">
              {isAdmin && (
                <button
                  type="button"
                  className="board-card-delete"
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  onClick={() => void removeBoard(board)}
                >
                  ×
                </button>
              )}
              <div>
                <h3>{board.name}</h3>
                <div className="meta">
                  {t("boards.updated", {
                    date: formatRelative(board.updatedAt, locale),
                  })}
                </div>
              </div>
              <div className="actions">
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/boards/${board.id}`}
                >
                  {t("common.open")}
                </Link>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAccessFor(board)}
                    >
                      {t("boards.access")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void renameBoard(board)}
                    >
                      {t("common.rename")}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {accessFor && (
        <BoardAccessDialog
          board={accessFor}
          onClose={() => setAccessFor(null)}
        />
      )}
    </AppShell>
  );
}

function formatRelative(iso: string, locale: string): string {
  const date = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
