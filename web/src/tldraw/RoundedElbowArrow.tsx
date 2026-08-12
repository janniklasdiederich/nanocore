import {
  PathBuilder,
  SVGContainer,
  STROKE_SIZES,
  getArrowInfo,
  useDefaultColorTheme,
  useEditor,
  useValue,
  type TLArrowShape,
} from "tldraw";
import { elbowDrawPoints, roundedElbowPathD } from "./roundedElbow";

// @ts-expect-error internal
import { getArrowheadPathForType } from "../../node_modules/tldraw/dist-esm/lib/shapes/arrow/arrowheads.mjs";

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
  const as = info.start.arrowhead && getArrowheadPathForType(info, "start", sw);
  const ae = info.end.arrowhead && getArrowheadPathForType(info, "end", sw);

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

export function roundedElbowSvg(shape: TLArrowShape, info: NonNullable<ReturnType<typeof getArrowInfo>>, strokeWidth: number) {
  const points = elbowDrawPoints(info);
  const radius = Math.max(14, strokeWidth * 4) * shape.props.scale;
  const d = roundedElbowPathD(points, radius);
  const path = new PathBuilder();
  // used only so toSvg export has a path element
  void path;
  return d;
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
