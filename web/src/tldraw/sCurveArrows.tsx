import {
  ArrowShapeUtil,
  Group2d,
  Polyline2d,
  STROKE_SIZES,
  SVGContainer,
  Vec,
  getArrowBindings,
  getArrowInfo,
  getArrowTerminalsInArrowSpace,
  getDefaultColorTheme,
  track,
  useDefaultColorTheme,
  useEditor,
  useValue,
  type Editor,
  type TLArrowShape,
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
 * CPs sit along the chord from each end with opposite lateral offsets → S shape.
 * `bend` (middle handle) scales S strength.
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
    return { start, end, cp1: { ...start }, cp2: { ...end } };
  }

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const along = len * 0.4;
  const minSide = Math.min(len * 0.14, 28 * scale);
  const maxSide = Math.min(len * 0.45, 120 * scale);
  const sign = bend === 0 ? -1 : Math.sign(bend);
  const side =
    sign * Math.min(maxSide, Math.max(minSide, Math.abs(bend) || minSide));

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

/** Binding-aware endpoints in arrow-local space (for free + sticky-bound arrows). */
export function getArrowEndpoints(
  editor: Editor,
  shape: TLArrowShape,
): { start: Pt; end: Pt } | null {
  try {
    const info = getArrowInfo(editor, shape);
    if (info?.isValid) {
      return {
        start: { x: info.start.point.x, y: info.start.point.y },
        end: { x: info.end.point.x, y: info.end.point.y },
      };
    }
    const bindings = getArrowBindings(editor, shape);
    const terminals = getArrowTerminalsInArrowSpace(editor, shape, bindings);
    return {
      start: { x: terminals.start.x, y: terminals.start.y },
      end: { x: terminals.end.x, y: terminals.end.y },
    };
  } catch {
    return {
      start: { ...shape.props.start },
      end: { ...shape.props.end },
    };
  }
}

function sCurvePathD(c: SCurveControls): string {
  return `M ${c.start.x} ${c.start.y} C ${c.cp1.x} ${c.cp1.y}, ${c.cp2.x} ${c.cp2.y}, ${c.end.x} ${c.end.y}`;
}

function sampleSCurve(c: SCurveControls, n = 28): Vec[] {
  const pts: Vec[] = [];
  const { start: a, cp1: b, cp2: c2, end: d } = c;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push(
      new Vec(
        u * u * u * a.x +
          3 * u * u * t * b.x +
          3 * u * t * t * c2.x +
          t * t * t * d.x,
        u * u * u * a.y +
          3 * u * u * t * b.y +
          3 * u * t * t * c2.y +
          t * t * t * d.y,
      ),
    );
  }
  return pts;
}

function arrowheadPath(
  tip: Pt,
  toward: Pt,
  strokeWidth: number,
  kind: string,
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
  const wx = -uy * size * 0.55;
  const wy = ux * size * 0.55;

  if (kind === "triangle") {
    return `M ${baseX + wx} ${baseY + wy} L ${tip.x} ${tip.y} L ${baseX - wx} ${baseY - wy} Z`;
  }
  // open arrow and other styles
  return `M ${baseX + wx} ${baseY + wy} L ${tip.x} ${tip.y} L ${baseX - wx} ${baseY - wy}`;
}

function controlsFor(
  editor: Editor,
  shape: TLArrowShape,
): SCurveControls | null {
  const endpoints = getArrowEndpoints(editor, shape);
  if (!endpoints) return null;
  return getSCurveControls(
    endpoints.start,
    endpoints.end,
    shape.props.bend,
    shape.props.scale,
  );
}

/**
 * Arc arrows as real cubic S-curves. Elbow mode stays stock.
 * Uses reactive `track()` so bindings update when sticky notes move.
 */
export class SCurveArrowShapeUtil extends ArrowShapeUtil {
  getDefaultProps(): TLArrowShape["props"] {
    return {
      ...super.getDefaultProps(),
      kind: "arc",
      bend: -32,
    };
  }

  getGeometry(shape: TLArrowShape) {
    if (shape.props.kind === "elbow") {
      return super.getGeometry(shape);
    }

    const c = controlsFor(this.editor, shape);
    if (!c) return super.getGeometry(shape);

    // Sampled polyline hits reliably (same approach as tldraw’s polyline bodies)
    const points = sampleSCurve(c, 32);
    if (points.length < 2) return super.getGeometry(shape);

    return new Group2d({
      children: [
        new Polyline2d({
          points,
        }),
      ],
    });
  }

  // Keep stock handles (start / middle / end) so arrows stay selectable & editable
  // getHandles → super

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
    const c = controlsFor(this.editor, shape);
    if (!c) return super.toSvg(shape, ctx);
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
      </g>
    );
  }
}

/** track() re-renders when bound shapes move (sticky notes, etc.). */
const SCurveArrowSvg = track(function SCurveArrowSvg({
  shape,
}: {
  shape: TLArrowShape;
}) {
  const editor = useEditor();
  const theme = useDefaultColorTheme();
  const zoom = useValue("zoom", () => editor.getZoomLevel(), [editor]);

  // Read bindings so `track` subscribes to them
  const bindings = getArrowBindings(editor, shape);
  void bindings;
  // Also touch bound shape records for transform tracking
  if (bindings.start) editor.getShape(bindings.start.toId);
  if (bindings.end) editor.getShape(bindings.end.toId);

  const c = controlsFor(editor, shape);
  if (!c) return null;

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

  const info = getArrowInfo(editor, shape);
  const showHint =
    !!(bindings.start || bindings.end) &&
    !!info &&
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
        {showHint && info && (
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
});

const SCurveArrowIndicator = track(function SCurveArrowIndicator({
  shape,
}: {
  shape: TLArrowShape;
}) {
  const editor = useEditor();
  const bindings = getArrowBindings(editor, shape);
  if (bindings.start) editor.getShape(bindings.start.toId);
  if (bindings.end) editor.getShape(bindings.end.toId);

  const c = controlsFor(editor, shape);
  if (!c) return null;
  return <path d={sCurvePathD(c)} />;
});

/**
 * No continuous store rewriting — that broke selection/moving.
 * Bend defaults from getDefaultProps; middle handle still adjusts S strength.
 */
export function registerSCurveArrows(_editor: Editor): () => void {
  return () => {};
}

/** @deprecated */
export const SoftArrowShapeUtil = SCurveArrowShapeUtil;
/** @deprecated */
export const registerSoftArrows = registerSCurveArrows;
