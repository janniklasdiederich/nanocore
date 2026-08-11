import {
  ArrowShapeUtil,
  type Editor,
  type TLArrowShape,
  type TLShapeId,
} from "tldraw";

/** Below this |bend| (× scale), tldraw treats the arrow as straight. */
const STRAIGHT_THRESHOLD = 8;

type ArrowMeta = {
  /** When true (default for new arrows), bend is kept auto-soft as ends move. */
  autoCurve?: boolean;
};

/**
 * Arc arrows that always start with a soft curve (never dead-straight),
 * and keep that curve proportional to length until the user drags the middle handle.
 *
 * Note: tldraw only supports a *single* arc bend (C-curve), not true cubic S-curves.
 * This is the best built-in approximation of Miro-style "always a bit curved" connectors.
 */
export class SoftArrowShapeUtil extends ArrowShapeUtil {
  getDefaultProps(): TLArrowShape["props"] {
    return {
      ...super.getDefaultProps(),
      kind: "arc",
      // Non-zero so first paint isn't a hairline straight; auto-curve refines it.
      bend: -(STRAIGHT_THRESHOLD + 12),
    };
  }
}

function isArrow(shape: { type: string }): shape is TLArrowShape {
  return shape.type === "arrow";
}

function spanLength(shape: TLArrowShape): number {
  const { start, end } = shape.props;
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/** Soft C-curve magnitude from chord length (screen-ish props space). */
export function computeSoftBend(shape: TLArrowShape): number {
  const len = spanLength(shape);
  const scale = shape.props.scale || 1;
  if (len < 12 * scale) {
    // Too short — keep just past the straight threshold
    return -(STRAIGHT_THRESHOLD * scale + 2);
  }
  // ~20% of length, clamped — readable at small and large spans
  const mag = Math.min(100 * scale, Math.max(STRAIGHT_THRESHOLD * scale + 4, len * 0.2));
  // Negative = one consistent side relative to tldraw's bend convention
  return -mag;
}

function wantsAutoCurve(shape: TLArrowShape): boolean {
  if (shape.props.kind !== "arc") return false;
  const meta = shape.meta as ArrowMeta;
  return meta.autoCurve !== false;
}

/**
 * Keep arc arrows softly curved like Miro defaults, until the user edits the bend handle.
 */
export function registerSoftArrows(editor: Editor): () => void {
  const applying = new Set<TLShapeId>();

  const apply = (shape: TLArrowShape) => {
    if (applying.has(shape.id)) return;
    if (!wantsAutoCurve(shape)) return;

    const bend = computeSoftBend(shape);
    if (Math.abs(shape.props.bend - bend) < 0.75) {
      // Still ensure meta is marked auto for brand-new shapes
      if ((shape.meta as ArrowMeta).autoCurve === undefined) {
        applying.add(shape.id);
        editor.updateShape({
          id: shape.id,
          type: "arrow",
          meta: { ...shape.meta, autoCurve: true },
        });
        applying.delete(shape.id);
      }
      return;
    }

    applying.add(shape.id);
    editor.updateShape({
      id: shape.id,
      type: "arrow",
      props: { bend },
      meta: { ...shape.meta, autoCurve: true },
    });
    applying.delete(shape.id);
  };

  // Prefer store listen — works even when sideEffects.register shape differs by version
  let prevById = new Map<TLShapeId, TLArrowShape>();

  const unsub = editor.store.listen(
    () => {
      const arrows = editor
        .getCurrentPageShapes()
        .filter(isArrow) as TLArrowShape[];

      const nextById = new Map<TLShapeId, TLArrowShape>();

      for (const shape of arrows) {
        nextById.set(shape.id, shape);
        const prev = prevById.get(shape.id);

        if (!prev) {
          // Created
          apply(shape);
          continue;
        }

        if (applying.has(shape.id)) continue;

        // Manual bend edit (middle handle) → stop auto-curve
        if (
          prev.props.bend !== shape.props.bend &&
          wantsAutoCurve(prev) &&
          // Ignore our own auto writes via applying set; here bend changed without applying
          Math.abs(shape.props.bend - computeSoftBend(shape)) > 1.5
        ) {
          // User-driven bend: freeze auto
          if ((shape.meta as ArrowMeta).autoCurve !== false) {
            applying.add(shape.id);
            editor.updateShape({
              id: shape.id,
              type: "arrow",
              meta: { ...shape.meta, autoCurve: false },
            });
            applying.delete(shape.id);
          }
          continue;
        }

        // Ends moved (draw / drag terminals) while auto
        if (
          prev.props.start.x !== shape.props.start.x ||
          prev.props.start.y !== shape.props.start.y ||
          prev.props.end.x !== shape.props.end.x ||
          prev.props.end.y !== shape.props.end.y ||
          prev.props.scale !== shape.props.scale
        ) {
          apply(shape);
        }
      }

      prevById = nextById;
    },
    { source: "all", scope: "document" },
  );

  return unsub;
}
