import { track, useEditor, type Editor } from "tldraw";
import { useT } from "../i18n";

/** Default canvas color (tldraw-like light grey). Stored in document.meta. */
export const DEFAULT_BOARD_BACKGROUND = "#f2f3f5";

const PRESETS = [
  "#f2f3f5", // light grey (default)
  "#ffffff", // white
  "#1a1d24", // dark
  "#0f172a", // slate
  "#ecfdf5", // mint
  "#eff6ff", // sky
  "#fef3c7", // warm
  "#fce7f3", // rose
] as const;

const META_KEY = "backgroundColor";

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

export function getBoardBackgroundColor(editor: Editor): string {
  const meta = editor.getDocumentSettings().meta;
  const raw = meta?.[META_KEY];
  return isHexColor(raw) ? raw : DEFAULT_BOARD_BACKGROUND;
}

export function setBoardBackgroundColor(editor: Editor, color: string): void {
  if (!isHexColor(color)) return;
  const current = editor.getDocumentSettings();
  editor.updateDocumentSettings({
    meta: {
      ...current.meta,
      [META_KEY]: color,
    },
  });
}

/**
 * Replaces tldraw's default Background. Color lives in document.meta so it
 * syncs to all collaborators via the multiplayer store.
 * @see https://tldraw.dev/examples/custom-components
 */
export const BoardBackground = track(function BoardBackground() {
  const editor = useEditor();
  const color = getBoardBackgroundColor(editor);

  return (
    <div
      className="board-canvas-bg"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: color,
        pointerEvents: "none",
      }}
    />
  );
});

/** Floating control (rendered as a child of Tldraw so it has editor context). */
export const BoardBackgroundToolbar = track(function BoardBackgroundToolbar() {
  const editor = useEditor();
  const t = useT();
  const color = getBoardBackgroundColor(editor);

  return (
    <div className="board-bg-toolbar" title={t("board.backgroundTitle")}>
      <label className="board-bg-toolbar-label">
        <span className="board-bg-toolbar-text">{t("board.background")}</span>
        <input
          type="color"
          className="board-bg-color-input"
          value={normalizeHex6(color)}
          aria-label={t("board.background")}
          onChange={(e) => setBoardBackgroundColor(editor, e.target.value)}
        />
      </label>
      <div className="board-bg-presets" role="list">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            role="listitem"
            className={
              "board-bg-swatch" +
              (normalizeHex6(color) === normalizeHex6(preset) ? " is-active" : "")
            }
            style={{ backgroundColor: preset }}
            title={preset}
            aria-label={t("board.backgroundPreset", { color: preset })}
            onClick={() => setBoardBackgroundColor(editor, preset)}
          />
        ))}
      </div>
    </div>
  );
});

/** Expand #rgb → #rrggbb for <input type="color">. */
function normalizeHex6(hex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1]!;
    const g = hex[2]!;
    const b = hex[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_BOARD_BACKGROUND;
}
