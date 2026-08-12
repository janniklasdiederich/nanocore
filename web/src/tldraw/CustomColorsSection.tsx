import { useCallback, useEffect, useRef, useState } from "react";
import {
  DefaultColorStyle,
  track,
  useEditor,
  useValue,
} from "tldraw";
import { useT } from "../i18n";
import {
  MAX_CUSTOM_COLORS,
  addCustomColor,
  applyCustomColorSlot,
  customKeyForIndex,
  isCustomColorKey,
  normalizeHex6,
  readCustomPalette,
  removeCustomColor,
  syncCustomColorsFromDocument,
} from "./customColors";

const COLLAPSE_KEY = "nanocore.customColors.expanded";

function readExpandedDefault(): boolean {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    // ignore
  }
  // Default expanded so the feature is discoverable
  return true;
}

/**
 * Style-panel section: color picker + saved custom swatches.
 * Collapsible header keeps the panel compact when not needed.
 */
export const CustomColorsSection = track(function CustomColorsSection() {
  const editor = useEditor();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-render when document meta palette changes (incl. remote collab)
  const palette = useValue(
    "customPalette",
    () => readCustomPalette(editor),
    [editor],
  );

  // Keep theme entries in sync with meta
  useEffect(() => {
    syncCustomColorsFromDocument(editor);
  }, [editor, palette]);

  const currentColor = useValue(
    "currentColorStyle",
    () => {
      const shared = editor.getSharedStyles().get(DefaultColorStyle);
      if (shared?.type === "shared") return shared.value as string;
      return editor.getStyleForNextShape(DefaultColorStyle) as string;
    },
    [editor],
  );

  const [expanded, setExpanded] = useState(readExpandedDefault);
  const [draft, setDraft] = useState("#6c8cff");
  const [picking, setPicking] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) setPicking(false);
      return next;
    });
  }, []);

  const openPicker = useCallback(() => {
    setDraft(randomPleasantHex());
    setPicking(true);
    // Open native picker on next frame so the staging UI is visible
    requestAnimationFrame(() => inputRef.current?.click());
  }, []);

  const commit = useCallback(() => {
    addCustomColor(editor, draft, { apply: true });
    setPicking(false);
  }, [editor, draft]);

  const cancel = useCallback(() => setPicking(false), []);

  const isFull = palette.length >= MAX_CUSTOM_COLORS;

  return (
    <div
      className={
        "tlui-style-panel__section nc-custom-colors" +
        (expanded ? " is-expanded" : " is-collapsed")
      }
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="nc-custom-colors__toggle"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        title={
          expanded
            ? t("board.customColorsCollapse")
            : t("board.customColorsExpand")
        }
      >
        <span className="nc-custom-colors__chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
        <span className="nc-custom-colors__title">
          {t("board.customColors")}
        </span>
        <span className="nc-custom-colors__count">
          {palette.length}/{MAX_CUSTOM_COLORS}
        </span>
      </button>

      {expanded && (
        <div className="nc-custom-colors__body">
          {palette.length > 0 && (
            <div className="nc-custom-colors__swatches" role="list">
              {palette.map((hex, i) => {
                const key = customKeyForIndex(i);
                const active = currentColor === key;
                return (
                  <div
                    key={key}
                    className="nc-custom-colors__swatch-wrap"
                    role="listitem"
                  >
                    <button
                      type="button"
                      className={
                        "nc-custom-colors__swatch" +
                        (active ? " is-active" : "")
                      }
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={t("board.customColorApply", { color: hex })}
                      aria-pressed={active}
                      onClick={() => applyCustomColorSlot(editor, i)}
                    />
                    <button
                      type="button"
                      className="nc-custom-colors__remove"
                      title={t("board.customColorRemove")}
                      aria-label={t("board.customColorRemove")}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomColor(editor, i);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {palette.length === 0 && !picking && (
            <p className="nc-custom-colors__empty">
              {t("board.customColorsEmpty")}
            </p>
          )}

          <input
            ref={inputRef}
            type="color"
            className="nc-custom-colors__native"
            value={normalizeHex6(draft)}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => setDraft(e.target.value)}
          />

          {picking ? (
            <div className="nc-custom-colors__staging">
              <button
                type="button"
                className="nc-custom-colors__swatch nc-custom-colors__swatch--lg"
                style={{ backgroundColor: draft }}
                onClick={() => inputRef.current?.click()}
                aria-label={t("board.customColorEdit")}
              />
              <code className="nc-custom-colors__hex">
                {draft.toUpperCase()}
              </code>
              <button
                type="button"
                className="nc-custom-colors__btn nc-custom-colors__btn--primary"
                onClick={commit}
              >
                {t("board.customColorSave")}
              </button>
              <button
                type="button"
                className="nc-custom-colors__btn"
                onClick={cancel}
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="nc-custom-colors__btn nc-custom-colors__btn--block"
              disabled={isFull}
              title={
                isFull
                  ? t("board.customColorsFull", { max: MAX_CUSTOM_COLORS })
                  : t("board.customColorAdd")
              }
              onClick={openPicker}
            >
              + {t("board.customColorAdd")}
            </button>
          )}

          {isCustomColorKey(currentColor) && (
            <p className="nc-custom-colors__hint">
              {t("board.customColorActive")}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

function randomPleasantHex(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 65, 52);
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    Math.round(
      255 * (lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))),
    );
  const hx = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`;
}
