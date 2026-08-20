import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type Board } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useI18n, useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { KanbanAccessDialog } from "./KanbanAccessDialog";

export function KanbanListPage() {
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
  const [deleteFor, setDeleteFor] = useState<Board | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listKanban();
      setBoards(res.boards);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useDocumentTitle(t("kanban.title"));

  async function createBoard() {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const res = await api.createKanban(t("kanban.defaultName"), [
        t("kanban.colTodo"),
        t("kanban.colDoing"),
        t("kanban.colDone"),
      ]);
      navigate(`/kanban/${res.board.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.createFailed"),
      );
      setCreating(false);
    }
  }

  async function renameBoard(board: Board) {
    if (!isAdmin) return;
    const name = window.prompt(t("kanban.renamePrompt"), board.name);
    if (!name || name.trim() === board.name) return;
    try {
      const res = await api.renameKanban(board.id, name.trim());
      setBoards((prev) =>
        prev.map((b) => (b.id === board.id ? res.board : b)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.renameFailed"),
      );
    }
  }

  async function confirmDelete(board: Board) {
    if (!isAdmin) return;
    try {
      await api.deleteKanban(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
      setDeleteFor(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.deleteFailed"),
      );
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>{t("kanban.title")}</h1>
          <p>{t("kanban.subtitle")}</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={creating}
            onClick={() => void createBoard()}
          >
            {creating ? t("kanban.creating") : t("kanban.new")}
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
          <p>{isAdmin ? t("kanban.empty") : t("kanban.emptyMember")}</p>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "auto", marginTop: 12 }}
              onClick={() => void createBoard()}
            >
              {t("kanban.createFirst")}
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
                  onClick={() => setDeleteFor(board)}
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
                  to={`/kanban/${board.id}`}
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
        <KanbanAccessDialog
          board={accessFor}
          onClose={() => setAccessFor(null)}
        />
      )}
      {deleteFor && (
        <KanbanDeleteDialog
          board={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={() => confirmDelete(deleteFor)}
        />
      )}
    </AppShell>
  );
}

function KanbanDeleteDialog({
  board,
  onClose,
  onConfirm,
}: {
  board: Board;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === board.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kanban-delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={(e) => void submit(e)}>
        <h2 id="kanban-delete-title">
          {t("kanban.deleteTitle", { name: board.name })}
        </h2>
        <p>{t("kanban.deleteHelp")}</p>
        <div className="field">
          <label htmlFor="kanban-delete-name">{t("kanban.deleteTypeName")}</label>
          <input
            id="kanban-delete-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-danger btn-sm"
            style={{ width: "auto" }}
            disabled={!matches || busy}
          >
            {busy ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      </form>
    </div>
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
