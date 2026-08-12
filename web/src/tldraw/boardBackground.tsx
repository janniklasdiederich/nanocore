import { track, useEditor } from "tldraw";
import { getPageBackgroundColor } from "./pageBackground";

/**
 * Canvas fill for the current page.
 * Color is stored on page.meta.backgroundColor (synced for all collaborators).
 * @see https://tldraw.dev/examples/custom-components
 */
export const BoardBackground = track(function BoardBackground() {
  const editor = useEditor();
  const color = getPageBackgroundColor(editor);

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
