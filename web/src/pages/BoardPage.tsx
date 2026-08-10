import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tldraw, type TLAssetStore } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import { api, type Board } from "../api";
import { useAuth } from "../auth";

const multiplayerAssets: TLAssetStore = {
  async upload(_asset, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/assets/upload", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Upload failed");
    }
    const data = (await res.json()) as { src: string };
    const src = new URL(data.src, window.location.origin).href;
    return { src };
  },
  resolve(asset) {
    return asset.props.src;
  },
};

/** WebSocket base — hit the API directly in dev (Vite's HTTP proxy is flaky for WS). */
function syncWsBase(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (import.meta.env.DEV) {
    return "ws://localhost:3001";
  }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, org } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .getBoard(id)
      .then((res) => setBoard(res.board))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const userInfo = useMemo(
    () => ({
      id: user?.id ?? "anonymous",
      name: user?.displayName ?? "Anonymous",
      color: user?.id ? colorFromId(user.id) : "#888888",
    }),
    [user],
  );

  if (!id) {
    return <div className="center-screen">Missing board id</div>;
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="auth-card">
          <h1>Could not open board</h1>
          <p className="subtitle">{error}</p>
          <Link className="btn btn-primary" to="/">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="board-page">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand" style={{ margin: 0 }}>
            <span className="brand-mark" aria-hidden />
            <span className="topbar-title">{org?.name || "Nanocore"}</span>
          </Link>
          <span className="topbar-meta">
            / {board?.name ?? "Loading…"}
          </span>
        </div>
        <div className="topbar-actions">
          <span className="topbar-meta">{user?.displayName}</span>
          <Link className="btn btn-secondary btn-sm" to="/">
            All boards
          </Link>
        </div>
      </header>
      <div className="canvas">
        {/* Only mount sync once we have a logged-in user id */}
        {user ? (
          <BoardCanvas boardId={id} userInfo={userInfo} />
        ) : (
          <div className="canvas-status">Loading session…</div>
        )}
      </div>
    </div>
  );
}

function BoardCanvas({
  boardId,
  userInfo,
}: {
  boardId: string;
  userInfo: { id: string; name: string; color: string };
}) {
  const uri = useMemo(() => {
    return async () => {
      // Mint a short-lived token over HTTP (cookie auth via Vite proxy is fine).
      // WebSocket then goes straight to the API with ?token=… — no cookie needed.
      // Do NOT add sessionId; useSync reserves and appends it.
      const { token } = await api.getSyncToken(boardId);
      const base = syncWsBase();
      return `${base}/api/sync/${boardId}?token=${encodeURIComponent(token)}`;
    };
  }, [boardId]);

  const store = useSync({
    uri,
    assets: multiplayerAssets,
    userInfo,
  });

  if (store.status === "loading") {
    return (
      <div className="canvas-status">
        <div>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          Connecting to board…
        </div>
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="canvas-status">
        Connection error: {store.error?.message ?? "unknown"}
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Is the API running on port 3001?
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Tldraw store={store} />
    </div>
  );
}

function colorFromId(id: string): string {
  const palette = [
    "#FF6B6B",
    "#FFD93D",
    "#6BCB77",
    "#4D96FF",
    "#C77DFF",
    "#FF9F1C",
    "#2EC4B6",
    "#E71D36",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
}
