import { track, useEditor, useIsDarkMode, type TLShapeId } from "tldraw";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Theme } from "emoji-picker-react";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { readReactions, toggleReaction, type ReactionMap } from "./shapeReactions";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

/**
 * Screen-space emoji reactions at the bottom-left of shapes.
 * Stored on shape.meta so they sync with the board.
 */
export const ShapeReactionsLayer = track(function ShapeReactionsLayer() {
  const editor = useEditor();
  const { user } = useAuth();
  const userId = user?.id;
  const [openFor, setOpenFor] = useState<TLShapeId | null>(null);

  if (!userId) return null;

  const hovered = editor.getHoveredShapeId();
  const selected = new Set(editor.getSelectedShapeIds());
  const currentPageId = editor.getCurrentPageId();

  const bars: {
    id: TLShapeId;
    left: number;
    top: number;
    reactions: ReactionMap;
    showAdd: boolean;
  }[] = [];

  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.parentId !== currentPageId && editor.getShape(shape.parentId)) {
      // still include children (notes in frames) — use page bounds
    }
    const reactions = readReactions(shape);
    const showAdd = hovered === shape.id || selected.has(shape.id);
    if (!showAdd && Object.keys(reactions).length === 0) continue;

    const bounds = editor.getShapePageBounds(shape);
    if (!bounds) continue;
    const screen = editor.pageToViewport({ x: bounds.minX, y: bounds.maxY });
    bars.push({
      id: shape.id,
      left: screen.x,
      top: screen.y + 6,
      reactions,
      showAdd,
    });
  }

  return (
    <div className="nc-reactions-layer">
      {bars.map((bar) => (
        <ReactionBar
          key={bar.id}
          left={bar.left}
          top={bar.top}
          reactions={bar.reactions}
          showAdd={bar.showAdd}
          userId={userId}
          pickerOpen={openFor === bar.id}
          onTogglePicker={() =>
            setOpenFor((cur) => (cur === bar.id ? null : bar.id))
          }
          onPick={(emoji) => {
            toggleReaction(editor, bar.id, emoji, userId);
            setOpenFor(null);
          }}
        />
      ))}
    </div>
  );
});

function ReactionBar({
  left,
  top,
  reactions,
  showAdd,
  userId,
  pickerOpen,
  onTogglePicker,
  onPick,
}: {
  left: number;
  top: number;
  reactions: ReactionMap;
  showAdd: boolean;
  userId: string;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onPick: (emoji: string) => void;
}) {
  const t = useT();
  const entries = Object.entries(reactions).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div
      className="nc-reaction-bar"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {entries.map(([emoji, users]) => {
        const mine = users.includes(userId);
        return (
          <button
            key={emoji}
            type="button"
            className={
              mine ? "nc-reaction-chip nc-reaction-chip--mine" : "nc-reaction-chip"
            }
            title={emoji}
            onClick={() => onPick(emoji)}
          >
            <span>{emoji}</span>
            <span className="nc-reaction-count">{users.length}</span>
          </button>
        );
      })}
      {showAdd && (
        <div className="nc-reaction-add-wrap">
          <button
            type="button"
            className="nc-reaction-add"
            title={t("reactions.add")}
            aria-label={t("reactions.add")}
            aria-expanded={pickerOpen}
            onClick={() => {
              if (!pickerOpen) onTogglePicker();
            }}
          >
            +
          </button>
          {pickerOpen && (
            <ReactionEmojiPicker onPick={onPick} onClose={onTogglePicker} />
          )}
        </div>
      )}
    </div>
  );
}

function ReactionEmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const dark = useIsDarkMode();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="nc-reaction-picker"
      onWheel={(e) => e.stopPropagation()}
    >
      <Suspense
        fallback={
          <div className="nc-reaction-picker-loading">{t("common.loading")}</div>
        }
      >
        <EmojiPicker
          theme={dark ? Theme.DARK : Theme.LIGHT}
          width={320}
          height={380}
          searchPlaceHolder={t("reactions.search")}
          previewConfig={{ showPreview: false }}
          lazyLoadEmojis
          skinTonesDisabled
          onEmojiClick={(item) => onPick(item.emoji)}
        />
      </Suspense>
    </div>
  );
}
