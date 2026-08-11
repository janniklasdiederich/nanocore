import { useCallback, useEffect, useRef, useState } from "react";
import {
  DefaultRichTextToolbar,
  DefaultRichTextToolbarContent,
  useEditor,
  useValue,
} from "tldraw";
import { DEFAULT_FONT_SIZE } from "./fontSizeOptions";

const MIN_PX = 8;
const MAX_PX = 96;

type SelectionRange = { from: number; to: number };

type TipTapLike = {
  on: (e: string, fn: (...args: unknown[]) => void) => void;
  off: (e: string, fn: (...args: unknown[]) => void) => void;
  getAttributes: (name: string) => Record<string, unknown>;
  state: { selection: SelectionRange };
  isFocused: boolean;
  chain: () => ChainEnd;
  commands: {
    focus: () => void;
    setTextSelection: (range: SelectionRange) => void;
  };
};

type ChainEnd = {
  focus: () => ChainEnd;
  setTextSelection: (range: SelectionRange) => ChainEnd;
  setFontSize: (size: string) => ChainEnd;
  run: () => boolean;
};

function parsePx(value: string | undefined | null): number {
  if (!value) return parseInt(DEFAULT_FONT_SIZE, 10);
  const n = parseInt(String(value).replace(/px$/i, ""), 10);
  return Number.isFinite(n) ? n : parseInt(DEFAULT_FONT_SIZE, 10);
}

function clampPx(n: number): number {
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.round(n)));
}

function isNonEmptyRange(sel: SelectionRange | null | undefined): sel is SelectionRange {
  return !!sel && sel.from !== sel.to;
}

/**
 * Floating rich-text toolbar with a numeric font-size field.
 *
 * TipTap drops the visual selection when the input is focused, so we:
 * 1) continuously remember the last non-empty canvas selection
 * 2) freeze that range when the size field is focused
 * 3) apply font-size to the frozen range (not the collapsed caret)
 * 4) restore the highlight after applying
 */
export function RichTextToolbarWithSize() {
  const editor = useEditor();
  const textEditor = useValue(
    "textEditor",
    () =>
      (
        editor as unknown as { getRichTextEditor?: () => TipTapLike | null }
      ).getRichTextEditor?.() ?? null,
    [editor],
  );

  /** Last non-empty selection while editing text on the canvas */
  const lastRangeRef = useRef<SelectionRange | null>(null);
  /** Selection frozen when the size input is focused */
  const frozenRangeRef = useRef<SelectionRange | null>(null);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  // Track selection from the canvas text editor (skip while size field is focused)
  useEffect(() => {
    if (!textEditor) return;

    const remember = () => {
      const sel = textEditor.state.selection;
      if (isNonEmptyRange(sel) && !focused) {
        lastRangeRef.current = { from: sel.from, to: sel.to };
      }
      if (!focused) {
        const px = parsePx(
          textEditor.getAttributes("textStyle").fontSize as string | undefined,
        );
        setDraft(String(px));
      }
    };

    remember();
    textEditor.on("selectionUpdate", remember);
    textEditor.on("transaction", remember);
    return () => {
      textEditor.off("selectionUpdate", remember);
      textEditor.off("transaction", remember);
    };
  }, [textEditor, focused]);

  const resolveTargetRange = useCallback((): SelectionRange | null => {
    if (isNonEmptyRange(frozenRangeRef.current)) return frozenRangeRef.current;
    if (isNonEmptyRange(lastRangeRef.current)) return lastRangeRef.current;
    if (textEditor && isNonEmptyRange(textEditor.state.selection)) {
      return { ...textEditor.state.selection };
    }
    return null;
  }, [textEditor]);

  const applySize = useCallback(
    (raw: string, { restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      if (!textEditor) return;

      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) {
        const px = parsePx(
          textEditor.getAttributes("textStyle").fontSize as string | undefined,
        );
        setDraft(String(px));
        return;
      }

      const px = clampPx(n);
      setDraft(String(px));

      const range = resolveTargetRange();
      if (!range) {
        // No range — apply at caret if any
        textEditor.chain().focus().setFontSize(`${px}px`).run();
        return;
      }

      // Apply to the remembered range, then put selection + focus back on the text
      textEditor
        .chain()
        .setTextSelection(range)
        .setFontSize(`${px}px`)
        .setTextSelection(range)
        .run();

      if (restoreFocus) {
        // Next frame so the input blur completes first
        requestAnimationFrame(() => {
          try {
            textEditor.commands.setTextSelection(range);
            textEditor.commands.focus();
          } catch {
            // editor may have unmounted
          }
        });
      }

      // Keep frozen range so further edits still hit the same span
      frozenRangeRef.current = range;
      lastRangeRef.current = range;
    },
    [textEditor, resolveTargetRange],
  );

  if (!textEditor) return null;

  return (
    <DefaultRichTextToolbar>
      <div
        className="nc-rich-text-size-group"
        role="group"
        aria-label="Font size"
      >
        <input
          type="number"
          className="nc-rich-text-size-input"
          inputMode="numeric"
          min={MIN_PX}
          max={MAX_PX}
          step={1}
          value={draft}
          title="Font size (px) — applies to selected text"
          aria-label="Font size in pixels"
          onPointerDown={() => {
            // Freeze selection BEFORE the input takes focus and TipTap collapses it
            const sel = textEditor.state.selection;
            if (isNonEmptyRange(sel)) {
              frozenRangeRef.current = { from: sel.from, to: sel.to };
              lastRangeRef.current = frozenRangeRef.current;
            } else if (isNonEmptyRange(lastRangeRef.current)) {
              frozenRangeRef.current = lastRangeRef.current;
            }
          }}
          onFocus={() => {
            // Pointerdown already froze; double-check from last remembered range
            if (
              !isNonEmptyRange(frozenRangeRef.current) &&
              isNonEmptyRange(lastRangeRef.current)
            ) {
              frozenRangeRef.current = lastRangeRef.current;
            }
            setFocused(true);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            applySize(draft, { restoreFocus: true });
          }}
          onKeyDown={(e) => {
            // Keep canvas shortcuts from eating keys while typing a size
            e.stopPropagation();

            if (e.key === "Enter") {
              e.preventDefault();
              applySize(draft, { restoreFocus: true });
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              const px = parsePx(
                textEditor.getAttributes("textStyle").fontSize as
                  | string
                  | undefined,
              );
              setDraft(String(px));
              setFocused(false);
              (e.target as HTMLInputElement).blur();
              const range = resolveTargetRange();
              if (range) {
                textEditor.commands.setTextSelection(range);
              }
              textEditor.commands.focus();
            }
          }}
        />
        <span className="nc-rich-text-size-unit" aria-hidden>
          px
        </span>
      </div>
      <DefaultRichTextToolbarContent textEditor={textEditor as never} />
    </DefaultRichTextToolbar>
  );
}
