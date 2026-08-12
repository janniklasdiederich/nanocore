import { PathBuilder, type TLArrowShape } from "tldraw";

export const ROUNDED_ELBOW_META = "nanocoreRoundedElbow";

export function isRoundedElbow(shape: TLArrowShape): boolean {
  return (
    shape.props.kind === "elbow" && shape.meta?.[ROUNDED_ELBOW_META] === true
  );
}

export function setPreferRoundedElbow(value: boolean): void {
  preferRoundedElbow = value;
}

export function getPreferRoundedElbow(): boolean {
  return preferRoundedElbow;
}

let preferRoundedElbow = false;

/** Orthogonal elbow polyline with quadratic-style rounded corners. */
export function roundedElbowPathD(
  points: { x: number; y: number }[],
  radius: number,
): string {
  const path = new PathBuilder();
  if (points.length === 0) return "";
  if (points.length === 1) {
    path.moveTo(points[0]!.x, points[0]!.y);
    return path.toD();
  }
  if (points.length === 2) {
    path.moveTo(points[0]!.x, points[0]!.y);
    path.lineTo(points[1]!.x, points[1]!.y);
    return path.toD();
  }

  path.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const dx1 = prev.x - curr.x;
    const dy1 = prev.y - curr.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    if (len1 < 0.5 || len2 < 0.5) {
      path.lineTo(curr.x, curr.y);
      continue;
    }
    const r = Math.min(radius, len1 * 0.5, len2 * 0.5);
    const p1x = curr.x + (dx1 / len1) * r;
    const p1y = curr.y + (dy1 / len1) * r;
    const p2x = curr.x + (dx2 / len2) * r;
    const p2y = curr.y + (dy2 / len2) * r;
    path.lineTo(p1x, p1y);
    // Quadratic-equivalent cubic: both controls at the sharp corner
    path.cubicBezierTo(p2x, p2y, curr.x, curr.y, curr.x, curr.y);
  }
  const last = points[points.length - 1]!;
  path.lineTo(last.x, last.y);
  return path.toD();
}

export function elbowDrawPoints(
  info: { type: string; route?: { points: { x: number; y: number }[]; skipPointsWhenDrawing?: Set<unknown> } },
): { x: number; y: number }[] {
  if (info.type !== "elbow" || !info.route) return [];
  const skip = info.route.skipPointsWhenDrawing;
  return info.route.points.filter((p) => !skip || !skip.has(p));
}
