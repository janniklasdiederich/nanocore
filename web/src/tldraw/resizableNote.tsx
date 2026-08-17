/**
 * Stickies resize like rectangles (independent width / height).
 * Size lives on shape.meta so the stock note schema stays valid.
 */
import { useLayoutEffect, useRef } from "react";
import {
  Group2d,
  NoteShapeUtil,
  Rectangle2d,
  type IndexKey,
  type TLHandle,
  type TLNoteShape,
  type TLResizeInfo,
} from "tldraw";

const SIZE_META = "nanocoreNoteSize";
const DEFAULT_NOTE = 200;
const MIN_NOTE = 80;

type NoteBox = { w: number; h: number };

function readStoredSize(shape: TLNoteShape): NoteBox | null {
  const raw = shape.meta[SIZE_META];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const w = Number(rec.w);
  const h = Number(rec.h);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return null;
  return { w, h };
}

function scaledBox(shape: TLNoteShape, stored: NoteBox): NoteBox {
  const s = shape.props.scale;
  return { w: stored.w * s, h: stored.h * s };
}

export class NanocoreNoteShapeUtil extends NoteShapeUtil {
  override hideResizeHandles() {
    return false;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override hideSelectionBoundsFg() {
    return false;
  }

  getGeometry(shape: TLNoteShape) {
    const stored = readStoredSize(shape);
    if (!stored) return super.getGeometry(shape);
    const { w, h } = scaledBox(shape, stored);
    return new Group2d({
      children: [
        new Rectangle2d({ width: w, height: h, isFilled: true }),
        new Rectangle2d({
          width: w,
          height: h,
          isFilled: true,
          isLabel: true,
        }),
      ],
    });
  }

  override getHandles(shape: TLNoteShape): TLHandle[] {
    const stored = readStoredSize(shape);
    if (!stored) return super.getHandles(shape);

    if (this.editor.getInstanceState().isCoarsePointer) return [];
    const { scale } = shape.props;
    const zoom = this.editor.getZoomLevel();
    if (zoom * scale < 0.25) return [];

    const { w, h } = scaledBox(shape, stored);
    if (zoom * scale < 0.5) {
      return [
        {
          id: "bottom",
          index: "a3" as IndexKey,
          type: "clone",
          x: w / 2,
          y: h,
        },
      ];
    }
    return [
      { id: "top", index: "a1" as IndexKey, type: "clone", x: w / 2, y: 0 },
      { id: "right", index: "a2" as IndexKey, type: "clone", x: w, y: h / 2 },
      { id: "bottom", index: "a3" as IndexKey, type: "clone", x: w / 2, y: h },
      { id: "left", index: "a4" as IndexKey, type: "clone", x: 0, y: h / 2 },
    ];
  }

  override onResize(shape: TLNoteShape, info: TLResizeInfo<TLNoteShape>) {
    const start = readStoredSize(info.initialShape) ?? {
      w: DEFAULT_NOTE,
      h: DEFAULT_NOTE + info.initialShape.props.growY,
    };
    const w = Math.max(MIN_NOTE, Math.abs(start.w * info.scaleX));
    const h = Math.max(MIN_NOTE, Math.abs(start.h * info.scaleY));
    return {
      x: info.newPoint.x,
      y: info.newPoint.y,
      props: {
        scale: shape.props.scale,
        growY: 0,
        fontSizeAdjustment: 0,
      },
      meta: {
        ...shape.meta,
        [SIZE_META]: { w, h },
      },
    };
  }

  indicator(shape: TLNoteShape) {
    const stored = readStoredSize(shape);
    if (!stored) return super.indicator(shape);
    const { w, h } = scaledBox(shape, stored);
    return <rect rx={shape.props.scale} width={w} height={h} />;
  }

  component(shape: TLNoteShape) {
    const inner = super.component(shape);
    const stored = readStoredSize(shape);
    const rootRef = useRef<HTMLDivElement>(null);
    const scale = shape.props.scale;

    useLayoutEffect(() => {
      if (!stored) return;
      const el = rootRef.current?.querySelector(
        ".tl-note__container",
      ) as HTMLElement | null;
      if (!el) return;
      el.style.width = `${stored.w * scale}px`;
      el.style.height = `${stored.h * scale}px`;
    });

    return (
      <div ref={rootRef} className="nc-note-box">
        {inner}
      </div>
    );
  }
}
