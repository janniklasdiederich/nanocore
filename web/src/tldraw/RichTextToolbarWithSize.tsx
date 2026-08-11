import { useEffect, useState } from "react";
import {
  DefaultRichTextToolbar,
  DefaultRichTextToolbarContent,
  useEditor,
  useValue,
} from "tldraw";
import { DEFAULT_FONT_SIZE, FONT_SIZE_OPTIONS } from "./fontSizeOptions";

/**
 * Floating rich-text toolbar with a font-size select + default bold/italic/etc.
 */
export function RichTextToolbarWithSize() {
  const editor = useEditor();
  const textEditor = useValue(
    "textEditor",
    // Runtime API present on tldraw Editor; typed loosely across versions
    () =>
      (
        editor as unknown as {
          getRichTextEditor?: () =>
            | {
                on: (e: string, fn: (...args: unknown[]) => void) => void;
                off: (e: string, fn: (...args: unknown[]) => void) => void;
                getAttributes: (name: string) => Record<string, unknown>;
                chain: () => {
                  focus: () => {
                    setFontSize: (size: string) => {
                      run: () => boolean;
                    };
                  };
                };
              }
            | null;
        }
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

  if (!textEditor) return null;

  const currentSize =
    (textEditor.getAttributes("textStyle").fontSize as string | undefined) ||
    DEFAULT_FONT_SIZE;

  return (
    <DefaultRichTextToolbar>
      <select
        className="nc-rich-text-size"
        value={currentSize}
        title="Font size"
        aria-label="Font size"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onChange={(e) => {
          const value = e.target.value;
          textEditor.chain().focus().setFontSize(value).run();
        }}
      >
        {FONT_SIZE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {!FONT_SIZE_OPTIONS.some((o) => o.value === currentSize) && (
          <option value={currentSize}>{currentSize}</option>
        )}
      </select>
      <DefaultRichTextToolbarContent
        textEditor={textEditor as never}
      />
    </DefaultRichTextToolbar>
  );
}
