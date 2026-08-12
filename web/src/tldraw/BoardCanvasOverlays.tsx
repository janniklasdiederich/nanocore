import { ShapeOwnerLayer } from "./ShapeOwnerLayer";
import { ShapeReactionsLayer } from "./ShapeReactionsLayer";

/** InFrontOfTheCanvas can only host one component — compose overlays here. */
export function BoardCanvasOverlays() {
  return (
    <>
      <ShapeReactionsLayer />
      <ShapeOwnerLayer />
    </>
  );
}
