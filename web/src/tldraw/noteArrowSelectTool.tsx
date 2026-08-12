import {
  ArrowShapeUtil,
  SelectTool,
  StateNode,
  getArrowInfo,
  type TLArrowShape,
  type TLHandleDragInfo,
  type TLNoteShape,
  type TLPointerEventInfo,
  type TLStateNodeConstructor,
} from "tldraw";
import { snapNoteArrowBinding, startArrowFromNoteHandle } from "./noteArrowAnchors";
import { RoundedElbowArrow } from "./RoundedElbowArrow";
import {
  elbowDrawPoints,
  isRoundedElbow,
  roundedElbowPathD,
} from "./roundedElbow";

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
    this.editor.setCursor({ type: "grabbing", rotation: 0 });
  }

  override onExit() {
    this.editor.setHintingShapes([]);
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onPointerUp() {
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

  override component(shape: TLArrowShape) {
    // Must return an element — calling super.component() here runs its hooks
    // inside InnerShape and crashes when this branch changes.
    return <NanocoreArrowBody shape={shape} util={this} />;
  }

  override toSvg(shape: TLArrowShape, ctx: Parameters<ArrowShapeUtil["toSvg"]>[1]) {
    if (!isRoundedElbow(shape)) return super.toSvg(shape, ctx);
    const info = getArrowInfo(this.editor, shape);
    if (!info?.isValid || info.type !== "elbow") return super.toSvg(shape, ctx);
    const sw = 3.5 * shape.props.scale;
    const d = roundedElbowPathD(
      elbowDrawPoints(info),
      Math.max(14, sw * 4) * shape.props.scale,
    );
    return <path d={d} />;
  }

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

function NanocoreArrowBody({
  shape,
  util,
}: {
  shape: TLArrowShape;
  util: NanocoreArrowShapeUtil;
}) {
  if (isRoundedElbow(shape)) {
    return <RoundedElbowArrow shape={shape} />;
  }
  return <StockArrowBody shape={shape} util={util} />;
}

function StockArrowBody({
  shape,
  util,
}: {
  shape: TLArrowShape;
  util: NanocoreArrowShapeUtil;
}) {
  return ArrowShapeUtil.prototype.component.call(util, shape) as never;
}
