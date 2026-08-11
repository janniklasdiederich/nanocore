import { useCallback, useEffect, useState } from "react";
import {
  DefaultRichTextToolbar,
  DefaultRichTextToolbarContent,
  TldrawUiToolbarButton,
  useEditor,
  useValue,
} from "tldraw";
import { DEFAULT_FONT_SIZE, FONT_SIZE_OPTIONS } from "./fontSizeOptions";

type TipTapLike = {
  on: (e: string, fn: (...args: unknown[]) => void) => void;
  off: (e: string, fn: (...args: unknown[]) => void) => void;
  getAttributes: (name: string) => Record<string, unknown>;
  chain: () => {
    focus: () => {
      setFontSize: (size: string) => { run: () => boolean };
    };
  };
};

/**
 * Keep pointerdown from stealing focus/selection (same as tldraw toolbar buttons).
 * Do NOT preventDefault on native <select> — it blocks opening.
 */
function keepTextSelection(e: React.PointerEvent | React.MouseEvent) {
  e.preventDefault();
}

function sizeIndex(value: string): number {
  const i = FONT_SIZE_OPTIONS.findIndex((o) => o.value === value);
  return i >= 0 ? i : FONT_SIZE_OPTIONS.findIndex((o) => o.value === DEFAULT_FONT_SIZE);
}

/**
 * Floating rich-text toolbar with A− / A+ size controls + default bold/italic/etc.
 * Uses real toolbar buttons so pointer-events and selection behavior match tldraw.
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
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!textEditor) return;
    const bump = () => setTick((n) => n + 1);
    textEditor.on("transaction", bump);
    textEditor.on("selectionUpdate", bump);
    return () => {
      textEditor.off("transaction", bump);
      textEditor.off("selectionUpdate", bump);
    };
  }, [textEditor]);

  const applySize = useCallback(
    (value: string) => {
      if (!textEditor) return;
      textEditor.chain().focus().setFontSize(value).run();
      setTick((n) => n + 1);
    },
    [textEditor],
  );

  if (!textEditor) return null;

  const currentSize =
    (textEditor.getAttributes("textStyle").fontSize as string | undefined) ||
    DEFAULT_FONT_SIZE;
  const idx = sizeIndex(currentSize);
  const label = FONT_SIZE_OPTIONS[idx]?.label ?? "M";
  const canSmaller = idx > 0;
  const canLarger = idx < FONT_SIZE_OPTIONS.length - 1;

  return (
    <DefaultRichTextToolbar>
      <div className="nc-rich-text-size-group" role="group" aria-label="Font size">
        <TldrawUiToolbarButton
          type="icon"
          title="Smaller text"
          aria-label="Smaller text"
          disabled={!canSmaller}
          onPointerDown={keepTextSelection}
          onClick={() => {
            if (!canSmaller) return;
            applySize(FONT_SIZE_OPTIONS[idx - 1]!.value);
          }}
        >
          <span className="nc-rich-text-size-btn">A−</span>
        </TldrawUiToolbarButton>
        <span className="nc-rich-text-size-label" title={`Font size ${currentSize}`}>
          {label}
        </span>
        <TldrawUiToolbarButton
          type="icon"
          title="Larger text"
          aria-label="Larger text"
          disabled={!canLarger}
          onPointerDown={keepTextSelection}
          onClick={() => {
            if (!canLarger) return;
            applySize(FONT_SIZE_OPTIONS[idx + 1]!.value);
          }}
        >
          <span className="nc-rich-text-size-btn">A+</span>
        </TldrawUiToolbarButton>
      </div>
      <DefaultRichTextToolbarContent textEditor={textEditor as never} />
    </DefaultRichTextToolbar>
  );
}
