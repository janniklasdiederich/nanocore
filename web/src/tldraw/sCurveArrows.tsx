import {
  ArrowShapeUtil,
  CubicBezier2d,
  Group2d,
  STROKE_SIZES,
  SVGContainer,
  Vec,
  getArrowBindings,
  getArrowInfo,
  getArrowTerminalsInArrowSpace,
  getDefaultColorTheme,
  useDefaultColorTheme,
  useEditor,
  useValue,
  type Editor,
  type TLArrowShape,
  type TLShapeId,
} from "tldraw";

type Pt = { x: number; y: number };

export type SCurveControls = {
  start: Pt;
  end: Pt;
  cp1: Pt;
  cp2: Pt;
};

/**
 * Miro-like cubic S-curve control points.
 * - CPs sit a fraction along the chord from each end
 * - Lateral offsets go opposite ways → classic S
 * - `bend` (from the middle handle) scales how strong the S is
 */
export function getSCurveControls(
  start: Pt,
  end: Pt,
  bend: number,
  scale = 1,
): SCurveControls {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);

  if (len < 1) {
    return {
      start,
      end,
      cp1: { ...start },
      cp2: { ...end },
    };
  }

  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular (left of direction)
  const px = -uy;
  const py = ux;

  // How far control points sit along the chord from each tip (Miro-like)
  const along = len * 0.4;

  // Lateral S strength — always at least a bit curved; middle-handle bend scales it
  const minSide = Math.min(len * 0.14, 28 * scale);
  const maxSide = Math.min(len * 0.45, 120 * scale);
  const sign = bend === 0 ? -1 : Math.sign(bend);
  const side = sign * Math.min(maxSide, Math.max(minSide, Math.abs(bend) || minSide));

  return {
    start,
    end,
    cp1: {
      x: start.x + ux * along + px * side,
      y: start.y + uy * along + py * side,
    },
    cp2: {
      x: end.x - ux * along - px * side,
      y: end.y - uy * along - py * side,
    },
  };
}

/** Resolve arrow endpoints in shape-local space (respects bindings). */
export function getArrowEndpoints(
  editor: Editor,
  shape: TLArrowShape,
): { start: Pt; end: Pt } | null {
  try {
    const bindings = getArrowBindings(editor, shape);
    const terminals = getArrowTerminalsInArrowSpace(editor, shape, bindings);
    return {
      start: { x: terminals.start.x, y: terminals.start.y },
      end: { x: terminals.end.x, y: terminals.end.y },
    };
  } catch {
    return {
      start: shape.props.start,
      end: shape.props.end,
    };
  }
}

function sCurvePathD(c: SCurveControls): string {
  return `M ${c.start.x} ${c.start.y} C ${c.cp1.x} ${c.cp1.y}, ${c.cp2.x} ${c.cp2.y}, ${c.end.x} ${c.end.y}`;
}

/** Simple filled arrowhead at a tip, oriented by control-point tangent. */
function arrowheadPath(
  tip: Pt,
  toward: Pt,
  strokeWidth: number,
  kind: "none" | "arrow" | string,
): string | null {
  if (kind === "none") return null;
  const dx = tip.x - toward.x;
  const dy = tip.y - toward.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = Math.max(strokeWidth * 2.8, 8);
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;
  // Perpendicular for wing tips
  const wx = -uy * size * 0.55;
  const wy = ux * size * 0.55;

  if (kind === "triangle" || kind === "arrow") {
    // Open V for classic arrow, closed triangle for "triangle"
    if (kind === "arrow") {
      return `M ${baseX + wx} ${baseY + wy} L ${tip.x} ${tip.y} L ${baseX - wx} ${baseY - wy}`;
    }
    return `M ${baseX + wx} ${baseY + wy} L ${tip.x} ${tip.y} L ${baseX - wx} ${baseY - wy} Z`;
  }

  // Fallback: same open arrow for other head styles we don't fully reimplement
  return `M ${baseX + wx} ${baseY + wy} L ${tip.x} ${tip.y} L ${baseX - wx} ${baseY - wy}`;
}

function defaultSoftBend(shape: TLArrowShape): number {
  const len = Math.hypot(
    shape.props.end.x - shape.props.start.x,
    shape.props.end.y - shape.props.start.y,
  );
  const scale = shape.props.scale || 1;
  return -Math.min(72 * scale, Math.max(16 * scale, len * 0.18));
}

/**
 * Arc arrows rendered as cubic S-curves (Miro-style flexible connectors).
 * Elbow arrows still use the stock orthogonal routing.
 */
export class SCurveArrowShapeUtil extends ArrowShapeUtil {
  getDefaultProps(): TLArrowShape["props"] {
    return {
      ...super.getDefaultProps(),
      kind: "arc",
      bend: -28,
    };
  }

  getGeometry(shape: TLArrowShape) {
    if (shape.props.kind === "elbow") {
      return super.getGeometry(shape);
    }

    const endpoints = getArrowEndpoints(this.editor, shape);
    if (!endpoints) return super.getGeometry(shape);

    const c = getSCurveControls(
      endpoints.start,
      endpoints.end,
      shape.props.bend,
      shape.props.scale,
    );

    // Group2d to match ArrowShapeUtil's return type (body ± optional label)
    return new Group2d({
      children: [
        new CubicBezier2d({
          start: new Vec(c.start.x, c.start.y),
          cp1: new Vec(c.cp1.x, c.cp1.y),
          cp2: new Vec(c.cp2.x, c.cp2.y),
          end: new Vec(c.end.x, c.end.y),
          resolution: 24,
        }),
      ],
    });
  }

  component(shape: TLArrowShape) {
    if (shape.props.kind === "elbow") {
      return super.component(shape);
    }
    return <SCurveArrowSvg shape={shape} />;
  }

  indicator(shape: TLArrowShape) {
    if (shape.props.kind === "elbow") {
      return super.indicator(shape);
    }
    return <SCurveArrowIndicator shape={shape} />;
  }

  toSvg(shape: TLArrowShape, ctx: Parameters<ArrowShapeUtil["toSvg"]>[1]) {
    if (shape.props.kind === "elbow") {
      return super.toSvg(shape, ctx);
    }
    const endpoints = getArrowEndpoints(this.editor, shape);
    if (!endpoints) return super.toSvg(shape, ctx);
    const c = getSCurveControls(
      endpoints.start,
      endpoints.end,
      shape.props.bend,
      shape.props.scale,
    );
    const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;
    const theme = getDefaultColorTheme({
      isDarkMode: ctx.isDarkMode ?? false,
    });
    const color = theme[shape.props.color].solid;
    const head = arrowheadPath(
      c.end,
      c.cp2,
      strokeWidth,
      shape.props.arrowheadEnd,
    );
    const headStart = arrowheadPath(
      c.start,
      c.cp1,
      strokeWidth,
      shape.props.arrowheadStart,
    );
    return (
      <g>
        <path
          d={sCurvePathD(c)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {head && (
          <path
            d={head}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {headStart && (
          <path
            d={headStart}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    );
  }
}

function SCurveArrowSvg({ shape }: { shape: TLArrowShape }) {
  const editor = useEditor();
  const theme = useDefaultColorTheme();
  const zoom = useValue("zoom", () => editor.getZoomLevel(), [editor]);

  const endpoints = getArrowEndpoints(editor, shape);
  if (!endpoints) return null;

  const c = getSCurveControls(
    endpoints.start,
    endpoints.end,
    shape.props.bend,
    shape.props.scale,
  );

  const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;
  const color = theme[shape.props.color].solid;
  const headEnd = arrowheadPath(
    c.end,
    c.cp2,
    strokeWidth,
    shape.props.arrowheadEnd,
  );
  const headStart = arrowheadPath(
    c.start,
    c.cp1,
    strokeWidth,
    shape.props.arrowheadStart,
  );

  // Hint line when bound (same idea as stock arrows)
  const bindings = getArrowBindings(editor, shape);
  const info = getArrowInfo(editor, shape);
  const showHint =
    (bindings.start || bindings.end) &&
    info &&
    editor.getOnlySelectedShapeId() === shape.id;

  return (
    <SVGContainer style={{ minWidth: 50, minHeight: 50 }}>
      <g
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {showHint && (
          <path
            d={`M ${info.start.handle.x} ${info.start.handle.y} L ${info.end.handle.x} ${info.end.handle.y}`}
            className="tl-arrow-hint"
            strokeWidth={2 / zoom}
            opacity={0.16}
            strokeDasharray="4 4"
          />
        )}
        <path d={sCurvePathD(c)} />
        {headStart && <path d={headStart} />}
        {headEnd && <path d={headEnd} />}
      </g>
    </SVGContainer>
  );
}

function SCurveArrowIndicator({ shape }: { shape: TLArrowShape }) {
  const editor = useEditor();
  const endpoints = getArrowEndpoints(editor, shape);
  if (!endpoints) return null;
  const c = getSCurveControls(
    endpoints.start,
    endpoints.end,
    shape.props.bend,
    shape.props.scale,
  );
  return <path d={sCurvePathD(c)} />;
}

/**
 * Keep S-curve strength (bend) proportional to length while autoCurve is on.
 * Dragging the middle handle freezes auto and becomes manual intensity control.
 */
export function registerSCurveArrows(editor: Editor): () => void {
  const applying = new Set<TLShapeId>();
  let prevById = new Map<TLShapeId, TLArrowShape>();

  const apply = (shape: TLArrowShape) => {
    if (applying.has(shape.id)) return;
    if (shape.props.kind !== "arc") return;
    const meta = shape.meta as { autoCurve?: boolean };
    if (meta.autoCurve === false) return;

    const bend = defaultSoftBend(shape);
    if (Math.abs(shape.props.bend - bend) < 0.75) {
      if (meta.autoCurve === undefined) {
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

  return editor.store.listen(
    () => {
      const arrows = editor
        .getCurrentPageShapes()
        .filter((s): s is TLArrowShape => s.type === "arrow");

      const nextById = new Map<TLShapeId, TLArrowShape>();

      for (const shape of arrows) {
        nextById.set(shape.id, shape);
        const prev = prevById.get(shape.id);

        if (!prev) {
          apply(shape);
          continue;
        }
        if (applying.has(shape.id)) continue;

        // Middle-handle / manual bend change → stop auto
        if (
          prev.props.bend !== shape.props.bend &&
          (prev.meta as { autoCurve?: boolean }).autoCurve !== false &&
          Math.abs(shape.props.bend - defaultSoftBend(shape)) > 2
        ) {
          applying.add(shape.id);
          editor.updateShape({
            id: shape.id,
            type: "arrow",
            meta: { ...shape.meta, autoCurve: false },
          });
          applying.delete(shape.id);
          continue;
        }

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
}

/** @deprecated use SCurveArrowShapeUtil */
export const SoftArrowShapeUtil = SCurveArrowShapeUtil;
/** @deprecated use registerSCurveArrows */
export const registerSoftArrows = registerSCurveArrows;
