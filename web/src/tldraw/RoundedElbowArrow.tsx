import {
  SVGContainer,
  STROKE_SIZES,
  getArrowInfo,
  useDefaultColorTheme,
  useEditor,
  useValue,
  type TLArrowShape,
} from "tldraw";
import { elbowDrawPoints, roundedElbowPathD } from "./roundedElbow";

export function RoundedElbowArrow({ shape }: { shape: TLArrowShape }) {
  const editor = useEditor();
  const theme = useDefaultColorTheme();
  const info = getArrowInfo(editor, shape);
  const forceSolid = useValue(
    "force solid",
    () => editor.getZoomLevel() < 0.2,
    [editor],
  );

  if (!info?.isValid || info.type !== "elbow") return null;

  const sw = STROKE_SIZES[shape.props.size] * shape.props.scale;
  const points = elbowDrawPoints(info);
  const radius = Math.max(14, sw * 4) * shape.props.scale;
  const d = roundedElbowPathD(points, radius);
  const dash = dashProps(shape.props.dash, sw, forceSolid);
  const color = theme[shape.props.color].solid;
  const as = chevronHead(points, "start", info.start.arrowhead, sw);
  const ae = chevronHead(points, "end", info.end.arrowhead, sw);

  return (
    <SVGContainer style={{ minWidth: 50, minHeight: 50 }}>
      <g
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        pointerEvents="none"
      >
        <path
          d={d}
          strokeDasharray={dash}
          stroke={(shape.props.dash as string) === "none" ? "none" : color}
        />
        {as ? <path d={as} /> : null}
        {ae ? <path d={ae} /> : null}
      </g>
    </SVGContainer>
  );
}

function chevronHead(
  points: { x: number; y: number }[],
  side: "start" | "end",
  kind: string | undefined,
  sw: number,
): string | null {
  if (!kind || kind === "none" || points.length < 2) return null;
  const tip = side === "end" ? points[points.length - 1]! : points[0]!;
  const prev = side === "end" ? points[points.length - 2]! : points[1]!;
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const back = Math.max(sw * 3, 8);
  const bx = tip.x - ux * back;
  const by = tip.y - uy * back;
  const px = -uy * back * 0.45;
  const py = ux * back * 0.45;
  if (kind === "triangle" || kind === "diamond" || kind === "square") {
    return `M ${bx + px} ${by + py} L ${tip.x} ${tip.y} L ${bx - px} ${by - py} Z`;
  }
  if (kind === "dot") {
    const r = sw * 1.2;
    return `M ${tip.x - r} ${tip.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  if (kind === "bar") {
    return `M ${tip.x + px} ${tip.y + py} L ${tip.x - px} ${tip.y - py}`;
  }
  return `M ${bx + px} ${by + py} L ${tip.x} ${tip.y} L ${bx - px} ${by - py}`;
}

function dashProps(
  dash: string,
  sw: number,
  forceSolid: boolean,
): string | undefined {
  if (forceSolid || dash === "solid" || dash === "draw") return undefined;
  if (dash === "dashed") return `${sw * 3} ${sw * 2}`;
  if (dash === "dotted") return `0.1 ${sw * 2}`;
  return undefined;
}
