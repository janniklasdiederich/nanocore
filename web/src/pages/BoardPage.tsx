import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Tldraw,
  defaultShapeUtils,
  type Editor,
  type TLAssetStore,
} from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import { api, type Board } from "../api";
import { useAuth } from "../auth";
import { BrandMark } from "../components/BrandMark";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { apiOrigin, apiUrl, syncWsBase } from "../config";
import { useI18n, useT } from "../i18n";
import { boardUiComponents } from "../tldraw/boardComponents";
import { boardUiOverrides } from "../tldraw/boardOverrides";
import { ColorableFrameShapeUtil } from "../tldraw/colorableFrame";
import { NanocoreNoteShapeUtil } from "../tldraw/resizableNote";
import { registerDeleteArrowsOnNoteDelete } from "../tldraw/noteArrowAnchors";
import {
  NanocoreArrowShapeUtil,
  NanocoreSelectTool,
} from "../tldraw/noteArrowSelectTool";
import { NanocoreDrawShapeUtil } from "../tldraw/styleExtras";
import {
  listenCustomColorPalette,
  syncCustomColorsFromDocument,
  syncCustomColorsFromStore,
} from "../tldraw/customColors";
import { registerMarkdownOnEditEnd } from "../tldraw/markdown";
import { registerShapeOwnerStamp } from "../tldraw/shapeOwner";
import { boardTextOptions } from "../tldraw/textOptions";
import { GIF_TOOL_ICON_ID, GIF_TOOL_ICON_URL } from "../tldraw/gifToolIcon";
import {
  KanbanCardShapeUtil,
  KanbanColumnShapeUtil,
} from "../tldraw/kanbanEmbed";
import {
  KANBAN_TOOL_ICON_ID,
  KANBAN_TOOL_ICON_URL,
} from "../tldraw/kanbanToolIcon";
import { useDocumentTitle } from "../useDocumentTitle";

const boardShapeUtils = [
  ColorableFrameShapeUtil,
  NanocoreNoteShapeUtil,
  NanocoreDrawShapeUtil,
  NanocoreArrowShapeUtil,
  KanbanCardShapeUtil,
  KanbanColumnShapeUtil,
];

/** Store schema must include every default shape plus kanban embeds.
 *  Passing only boardShapeUtils drops geo/image/text and the server
 *  rejects the client as CLIENT_TOO_OLD. */
const syncShapeUtils = [
  ...defaultShapeUtils,
  KanbanCardShapeUtil,
  KanbanColumnShapeUtil,
];
const boardTools = [NanocoreSelectTool];

const multiplayerAssets: TLAssetStore = {
  async upload(_asset, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(apiUrl("/api/assets/upload"), {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Upload failed");
    }
    const data = (await res.json()) as { src: string };
    // Resolve relative asset paths against API origin when split-hosted
    const base = apiOrigin() || window.location.origin;
    const src = new URL(data.src, base).href;
    return { src };
  },
  resolve(asset) {
    return asset.props.src;
  },
};

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, org } = useAuth();
  const t = useT();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .getBoard(id)
      .then((res) => setBoard(res.board))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useDocumentTitle(board?.name ?? t("board.loadingName"));

  const userInfo = useMemo(
    () => ({
      id: user?.id ?? "anonymous",
      name: user?.displayName ?? t("board.anonymous"),
      color: user?.id ? colorFromId(user.id) : "#888888",
    }),
    [user, t],
  );

  if (!id) {
    return <div className="center-screen">{t("board.missingId")}</div>;
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="auth-card">
          <h1>{t("board.openFailed")}</h1>
          <p className="subtitle">{error}</p>
          <Link className="btn btn-primary" to="/">
            {t("board.backToBoards")}
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
            <BrandMark />
            <span className="topbar-title">
              {org?.name || t("app.name")}
            </span>
          </Link>
          <span className="topbar-meta">
            / {board?.name ?? t("board.loadingName")}
          </span>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher compact />
          <span className="topbar-meta">{user?.displayName}</span>
          <Link className="btn btn-secondary btn-sm" to="/">
            {t("nav.allBoards")}
          </Link>
        </div>
      </header>
      <div className="canvas">
        {user ? (
          <BoardCanvas boardId={id} userInfo={userInfo} />
        ) : (
          <div className="canvas-status">{t("board.loadingSession")}</div>
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
  const t = useT();
  const { tldrawLocale } = useI18n();

  const uri = useMemo(() => {
    return async () => {
      const { token } = await api.getSyncToken(boardId);
      const base = syncWsBase();
      return `${base}/api/sync/${boardId}?token=${encodeURIComponent(token)}`;
    };
  }, [boardId]);

  const store = useSync({
    uri,
    assets: multiplayerAssets,
    userInfo,
    shapeUtils: syncShapeUtils,
  });

  // Apply palette from the synced store *before* Tldraw paints shapes, so
  // theme.custom-N exists and shapes don't crash on theme[color].solid
  useEffect(() => {
    if (store.status !== "synced-remote") return;
    syncCustomColorsFromStore(store.store);
  }, [store]);

  const onMount = useCallback(
    (editor: Editor) => {
      editor.user.updateUserPreferences({
        name: userInfo.name,
        color: userInfo.color,
        locale: tldrawLocale,
      });
      seedAlwaysSnappingOn(editor);
      syncCustomColorsFromDocument(editor);
      const stopPalette = listenCustomColorPalette(editor);
      const stopMarkdown = registerMarkdownOnEditEnd(editor);
      const stopOwner = registerShapeOwnerStamp(editor, {
        id: userInfo.id,
        name: userInfo.name,
      });
      const stopNoteArrows = registerDeleteArrowsOnNoteDelete(editor);
      return () => {
        stopPalette();
        stopMarkdown();
        stopOwner();
        stopNoteArrows();
      };
    },
    [userInfo.id, userInfo.name, userInfo.color, tldrawLocale],
  );

  if (store.status === "loading") {
    return (
      <div className="canvas-status">
        <div>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          {t("board.connecting")}
        </div>
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="canvas-status">
        {t("board.connectionError", {
          message: store.error?.message ?? "unknown",
        })}
        <div style={{ marginTop: 8, fontSize: 13 }}>{t("board.apiHint")}</div>
      </div>
    );
  }

  // status === 'synced-remote' — apply theme on this render before Tldraw mounts
  syncCustomColorsFromStore(store.store);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* key forces remount so tldraw picks up locale cleanly */}
      <Tldraw
        key={tldrawLocale}
        store={store}
        shapeUtils={boardShapeUtils}
        tools={boardTools}
        components={boardUiComponents}
        overrides={boardUiOverrides}
        assetUrls={{
          icons: {
            [GIF_TOOL_ICON_ID]: GIF_TOOL_ICON_URL,
            [KANBAN_TOOL_ICON_ID]: KANBAN_TOOL_ICON_URL,
          },
        }}
        textOptions={boardTextOptions}
        onMount={onMount}
      />
    </div>
  );
}

const SNAP_DEFAULT_KEY = "nanocore_always_snap_default_v1";

/** Product default is Always snapping on. Seed once so users can still turn it off. */
function seedAlwaysSnappingOn(editor: Editor) {
  try {
    if (localStorage.getItem(SNAP_DEFAULT_KEY) === "1") return;
    localStorage.setItem(SNAP_DEFAULT_KEY, "1");
  } catch {
    // still apply this session
  }
  editor.user.updateUserPreferences({ isSnapMode: true });
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
