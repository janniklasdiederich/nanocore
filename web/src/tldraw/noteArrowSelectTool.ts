import {
  ArrowShapeUtil,
  SelectTool,
  StateNode,
  getArrowBindings,
  type TLArrowShape,
  type TLHandleDragInfo,
  type TLNoteShape,
  type TLPointerEventInfo,
  type TLStateNodeConstructor,
} from "tldraw";
import { snapNoteArrowBinding, startArrowFromNoteHandle } from "./noteArrowAnchors";

/**
 * Same as tldraw PointingHandle, except note side-handles start arrows
 * instead of cloning stickies.
 */
export class NanocorePointingHandle extends StateNode {
  static override id = "pointing_handle";
  static override isLockable = false;
  static override useCoalescedEvents = false;

  didCtrlOnEnter = false;
  info = {} as TLPointerEventInfo & { target: "handle" };

  override onEnter(info: TLPointerEventInfo & { target: "handle" }) {
    this.info = info;
    this.didCtrlOnEnter = info.accelKey;

    const { shape } = info;
    if (this.editor.isShapeOfType<TLArrowShape>(shape, "arrow")) {
      const initialBindings = getArrowBindings(this.editor, shape);
      const currentBinding = initialBindings[info.handle.id as "start" | "end"];
      const oppositeBinding =
        initialBindings[info.handle.id === "start" ? "end" : "start"];
      const arrowTransform = this.editor.getShapePageTransform(shape.id);

      if (currentBinding && arrowTransform) {
        // Keep default hinting when dragging an existing arrow end
        void oppositeBinding;
      }
    }

    this.editor.setCursor({ type: "grabbing", rotation: 0 });
  }

  override onExit() {
    this.editor.setHintingShapes([]);
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onPointerUp() {
    // Clicking a note handle no longer creates/opens an adjacent sticky
    this.parent.transition("idle", this.info);
  }

  override onPointerMove(info: TLPointerEventInfo) {
    if (this.editor.inputs.isDragging) {
      if (this.didCtrlOnEnter) {
        this.parent.transition("brushing", info);
      } else {
        this.startDraggingHandle();
      }
    }
  }

  override onLongPress() {
    this.startDraggingHandle();
  }

  private startDraggingHandle() {
    const { editor } = this;
    if (editor.getIsReadonly()) return;
    const { shape, handle } = this.info;

    if (editor.isShapeOfType<TLNoteShape>(shape, "note")) {
      startArrowFromNoteHandle(editor, shape, handle);
      return;
    }

    this.parent.transition("dragging_handle", this.info);
  }

  override onCancel() {
    this.parent.transition("idle");
  }

  override onComplete() {
    this.parent.transition("idle");
  }

  override onInterrupt() {
    this.parent.transition("idle");
  }
}

export class NanocoreSelectTool extends SelectTool {
  static override id = "select";
  static override children(): TLStateNodeConstructor[] {
    return SelectTool.children().map((Child) =>
      Child.id === "pointing_handle" ? NanocorePointingHandle : Child,
    );
  }
}

/** Snap precise arrow ends on notes to the four sides or the center. */
export class NanocoreArrowShapeUtil extends ArrowShapeUtil {
  static override type = "arrow" as const;

  override onHandleDrag(
    shape: TLArrowShape,
    info: TLHandleDragInfo<TLArrowShape>,
  ) {
    const result = super.onHandleDrag(shape, info);
    const terminal = info.handle.id;
    if (terminal === "start" || terminal === "end") {
      snapNoteArrowBinding(this.editor, shape.id, terminal);
    }
    return result;
  }
}
