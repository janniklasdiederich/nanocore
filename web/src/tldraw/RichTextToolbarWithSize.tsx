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
  chain: () => {
    focus: () => ChainEnd;
  };
};

type ChainEnd = {
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

/**
 * Floating rich-text toolbar with a numeric font-size field + default formatting.
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

  const selectionRef = useRef<SelectionRange | null>(null);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [, setTick] = useState(0);

  // Keep draft in sync with selection attributes when not typing
  useEffect(() => {
    if (!textEditor) return;
    const sync = () => {
      if (focused) return;
      const px = parsePx(
        textEditor.getAttributes("textStyle").fontSize as string | undefined,
      );
      setDraft(String(px));
    };
    sync();
    textEditor.on("transaction", sync);
    textEditor.on("selectionUpdate", sync);
    return () => {
      textEditor.off("transaction", sync);
      textEditor.off("selectionUpdate", sync);
    };
  }, [textEditor, focused]);

  const applySize = useCallback(
    (raw: string) => {
      if (!textEditor) return;
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) {
        // Reset draft to current attribute
        const px = parsePx(
          textEditor.getAttributes("textStyle").fontSize as string | undefined,
        );
        setDraft(String(px));
        return;
      }
      const px = clampPx(n);
      setDraft(String(px));

      const sel = selectionRef.current ?? textEditor.state.selection;
      const chain = textEditor.chain().focus();
      // Restore the canvas text selection, then apply size
      chain.setTextSelection(sel).setFontSize(`${px}px`).run();
      setTick((t) => t + 1);
    },
    [textEditor],
  );

  if (!textEditor) return null;

  return (
    <DefaultRichTextToolbar>
      <div className="nc-rich-text-size-group" role="group" aria-label="Font size">
        <input
          type="number"
          className="nc-rich-text-size-input"
          inputMode="numeric"
          min={MIN_PX}
          max={MAX_PX}
          step={1}
          value={draft}
          title="Font size (px)"
          aria-label="Font size in pixels"
          onPointerDown={(e) => {
            // Capture current text selection before the input takes focus
            selectionRef.current = { ...textEditor.state.selection };
            e.stopPropagation();
          }}
          onFocus={() => {
            selectionRef.current = { ...textEditor.state.selection };
            setFocused(true);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            applySize(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applySize(draft);
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
              (e.target as HTMLInputElement).blur();
              textEditor.chain().focus().run();
            }
            // Don't let canvas shortcuts eat digits / arrows while typing
            e.stopPropagation();
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
