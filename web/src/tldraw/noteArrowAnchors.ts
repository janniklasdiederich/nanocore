import type { Editor, TLArrowShape, TLHandle, TLNoteShape, TLShapeId } from "tldraw";
import { createShapeId } from "tldraw";

/** Mid-edge + center anchors in note-local normalized space (0–1). */
export const NOTE_ARROW_ANCHORS = [
  { id: "center", x: 0.5, y: 0.5 },
  { id: "top", x: 0.5, y: 0 },
  { id: "right", x: 1, y: 0.5 },
  { id: "bottom", x: 0.5, y: 1 },
  { id: "left", x: 0, y: 0.5 },
] as const;

export function anchorForNoteHandle(handleId: string): { x: number; y: number } {
  switch (handleId) {
    case "top":
      return { x: 0.5, y: 0 };
    case "right":
      return { x: 1, y: 0.5 };
    case "bottom":
      return { x: 0.5, y: 1 };
    case "left":
      return { x: 0, y: 0.5 };
    default:
      return { x: 0.5, y: 0.5 };
  }
}

type NoteAnchor = { id: string; x: number; y: number };

export function nearestNoteAnchor(pt: { x: number; y: number }): NoteAnchor {
  let best: NoteAnchor = NOTE_ARROW_ANCHORS[0]!;
  let bestD = Infinity;
  for (const a of NOTE_ARROW_ANCHORS) {
    const d = (a.x - pt.x) ** 2 + (a.y - pt.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

type ArrowBindProps = {
  terminal: string;
  isPrecise: boolean;
  normalizedAnchor: { x: number; y: number };
};

/** Snap a precise arrow binding on a note to the nearest of the 5 anchors. */
export function snapNoteArrowBinding(
  editor: Editor,
  arrowId: TLShapeId,
  terminal: "start" | "end",
): void {
  const binding = editor.getBindingsFromShape(arrowId, "arrow").find((b) => {
    const props = b.props as ArrowBindProps;
    return props.terminal === terminal;
  });
  if (!binding) return;
  const props = binding.props as ArrowBindProps;
  if (!props.isPrecise) return;

  const target = editor.getShape(binding.toId);
  if (!target || target.type !== "note") return;

  const snapped = nearestNoteAnchor(props.normalizedAnchor);
  if (snapped.x === props.normalizedAnchor.x && snapped.y === props.normalizedAnchor.y) {
    return;
  }

  editor.updateBinding({
    ...binding,
    props: {
      ...props,
      normalizedAnchor: { x: snapped.x, y: snapped.y },
      snap: snapped.id === "center" ? "center" : "edge-point",
    },
  });
}

/** Create an arrow starting at a note side handle and begin dragging the tip. */
export function startArrowFromNoteHandle(
  editor: Editor,
  note: TLNoteShape,
  handle: TLHandle,
): void {
  if (editor.getIsReadonly()) return;

  const id = createShapeId();
  const origin = editor.getShapePageTransform(note.id)?.applyToPoint(handle);
  if (!origin) return;

  const markId = editor.markHistoryStoppingPoint(`creating_arrow:${id}`);
  editor.createShape<TLArrowShape>({
    id,
    type: "arrow",
    x: origin.x,
    y: origin.y,
    props: {
      scale: editor.user.getIsDynamicResizeMode()
        ? 1 / editor.getZoomLevel()
        : 1,
    },
  });

  const arrow = editor.getShape<TLArrowShape>(id);
  if (!arrow) return;

  const anchor = anchorForNoteHandle(handle.id);
  editor.createBinding({
    type: "arrow",
    fromId: id,
    toId: note.id,
    props: {
      terminal: "start",
      normalizedAnchor: anchor,
      isPrecise: true,
      isExact: false,
      snap: handle.id === "center" ? "center" : "edge-point",
    },
  });

  editor.select(id);
  editor.setCurrentTool("select.dragging_handle", {
    shape: editor.getShape(id),
    handle: { id: "end", type: "vertex", index: "a3", x: 0, y: 0 },
    isCreating: true,
    creatingMarkId: markId,
    onInteractionEnd: "select",
  });
}

/**
 * When a sticky is deleted, also delete arrows bound to it (either end).
 * Local user deletes only — the extra arrow deletes sync to peers.
 */
export function registerDeleteArrowsOnNoteDelete(editor: Editor): () => void {
  return editor.sideEffects.registerBeforeDeleteHandler(
    "shape",
    (shape, source) => {
      if (source !== "user") return;
      if (shape.type !== "note") return;
      const bindings = editor.getBindingsToShape(shape.id, "arrow");
      const arrowIds = [
        ...new Set(bindings.map((b) => b.fromId)),
      ].filter((id) => editor.getShape(id));
      if (arrowIds.length) editor.deleteShapes(arrowIds);
    },
  );
}
