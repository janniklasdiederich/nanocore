import { track, useEditor, type TLShapeId } from "tldraw";
import { useT } from "../i18n";
import { readOwner, useOwnerLabelMode } from "./shapeOwner";

/**
 * Screen-space owner name at the top-right of shapes.
 * Owner is stamped on shape.meta so it syncs with the board.
 */
export const ShapeOwnerLayer = track(function ShapeOwnerLayer() {
  const editor = useEditor();
  const t = useT();
  const mode = useOwnerLabelMode();

  if (mode === "never") return null;

  const hovered = editor.getHoveredShapeId();

  const labels: { id: TLShapeId; left: number; top: number; name: string }[] =
    [];

  for (const shape of editor.getCurrentPageShapes()) {
    const owner = readOwner(shape);
    if (!owner) continue;
    if (mode === "hover" && hovered !== shape.id) continue;

    const bounds = editor.getShapePageBounds(shape);
    if (!bounds) continue;
    const screen = editor.pageToViewport({ x: bounds.maxX, y: bounds.minY });
    labels.push({
      id: shape.id,
      left: screen.x,
      top: screen.y - 4,
      name: owner.name,
    });
  }

  if (!labels.length) return null;

  return (
    <div className="nc-owner-layer">
      {labels.map((label) => (
        <div
          key={label.id}
          className="nc-owner-label"
          style={{ left: label.left, top: label.top }}
          title={t("owner.placedBy", { name: label.name })}
        >
          {label.name}
        </div>
      ))}
    </div>
  );
});
