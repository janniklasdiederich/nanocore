import { FrameShapeUtil } from "tldraw";

/** Stock frames hide color (neutral white). This turns color into a real style. */
export const ColorableFrameShapeUtil = FrameShapeUtil.configure({
  showColors: true,
});
