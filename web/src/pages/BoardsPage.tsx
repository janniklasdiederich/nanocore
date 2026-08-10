import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type Board } from "../api";
import { AppShell } from "../components/AppShell";

export function BoardsPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listBoards();
      setBoards(res.boards);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBoard() {
    setCreating(true);
    try {
      const res = await api.createBoard("Untitled board");
      navigate(`/boards/${res.board.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create board");
      setCreating(false);
    }
  }

  async function renameBoard(board: Board) {
    const name = window.prompt("Board name", board.name);
    if (!name || name.trim() === board.name) return;
    try {
      const res = await api.renameBoard(board.id, name.trim());
      setBoards((prev) =>
        prev.map((b) => (b.id === board.id ? res.board : b)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rename failed");
    }
  }

  async function removeBoard(board: Board) {
    if (!window.confirm(`Delete “${board.name}”? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Boards</h1>
          <p>Shared infinite canvases for your team.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto" }}
          disabled={creating}
          onClick={() => void createBoard()}
        >
          {creating ? "Creating…" : "New board"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-screen" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <p>No boards yet. Create one to start collaborating.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto", marginTop: 12 }}
            onClick={() => void createBoard()}
          >
            Create your first board
          </button>
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <article key={board.id} className="board-card">
              <div>
                <h3>{board.name}</h3>
                <div className="meta">
                  Updated {formatRelative(board.updatedAt)}
                </div>
              </div>
              <div className="actions">
                <Link
                  className="btn btn-primary btn-sm"
                  style={{ width: "auto" }}
                  to={`/boards/${board.id}`}
                >
                  Open
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void renameBoard(board)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void removeBoard(board)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
