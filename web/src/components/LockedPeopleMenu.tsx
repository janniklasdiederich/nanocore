import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  useEditor,
  usePeerIds,
  usePresence,
  useValue,
  type TLComponents,
} from "tldraw";

/**
 * Share / people panel with a read-only display name.
 * Names are owned by Nanocore user management (admin-created accounts).
 *
 * Note: tldraw UI chrome uses pointer-events: none on layout zones;
 * interactive bits must set pointer-events: all (see styles).
 */
function NanocoreSharePanel() {
  return (
    <div className="tlui-share-zone" draggable={false}>
      <NanocorePeopleMenu />
    </div>
  );
}

function NanocorePeopleMenu() {
  const editor = useEditor();
  const userIds = usePeerIds();
  const userColor = useValue(
    "userColor",
    () => editor.user.getColor(),
    [editor],
  );
  const userName = useValue("userName", () => editor.user.getName(), [editor]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Match tldraw default: only show when someone else is on the board
  if (!userIds.length) return null;

  return (
    <div className="nc-people-menu" ref={rootRef}>
      <button
        type="button"
        className="nc-people-menu__trigger"
        title="People on this board"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="nc-people-menu__avatars">
          {userIds.slice(-5).map((id) => (
            <PeerAvatar key={id} userId={id} />
          ))}
          <div
            className="nc-people-menu__avatar nc-people-menu__avatar--self"
            style={{ backgroundColor: userColor }}
          >
            {(userName?.[0] ?? "?").toUpperCase()}
          </div>
          {userIds.length > 5 && (
            <div className="nc-people-menu__more">+{userIds.length - 5}</div>
          )}
        </div>
      </button>

      {open && (
        <div
          id={panelId}
          className="nc-people-menu__panel"
          role="menu"
        >
          <div className="nc-people-menu__section">
            <div className="nc-people-menu__self">
              <div
                className="nc-people-menu__avatar"
                style={{ backgroundColor: userColor }}
                aria-hidden
              >
                {(userName?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="nc-people-menu__self-text">
                <div className="nc-people-menu__name">
                  {userName || "You"}
                </div>
                <div className="nc-people-menu__hint">
                  Name is set by your organization
                </div>
              </div>
            </div>
          </div>
          <div className="nc-people-menu__section">
            {userIds.map((userId) => (
              <PeerRow key={userId} userId={userId} onActed={close} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeerAvatar({ userId }: { userId: string }) {
  const presence = usePresence(userId);
  if (!presence) return null;
  const letter = (presence.userName?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className="nc-people-menu__avatar"
      style={{ backgroundColor: presence.color }}
      title={presence.userName || "Anonymous"}
    >
      {letter}
    </div>
  );
}

function PeerRow({
  userId,
  onActed,
}: {
  userId: string;
  onActed?: () => void;
}) {
  const editor = useEditor();
  const presence = usePresence(userId);
  // Re-render when follow target changes
  const followingUserId = useValue(
    "following",
    () => editor.getInstanceState().followingUserId,
    [editor],
  );

  if (!presence) return null;

  const followingThem = followingUserId === userId;

  return (
    <div className="nc-people-menu__peer-row">
      <button
        type="button"
        className="nc-people-menu__peer"
        role="menuitem"
        title="Jump to user"
        onClick={() => {
          editor.zoomToUser(userId);
          onActed?.();
        }}
      >
        <span
          className="nc-people-menu__swatch"
          style={{ background: presence.color }}
        />
        <span className="nc-people-menu__name">
          {presence.userName?.trim() || "Anonymous"}
        </span>
      </button>
      <button
        type="button"
        className={
          followingThem
            ? "nc-people-menu__follow nc-people-menu__follow--active"
            : "nc-people-menu__follow"
        }
        title={followingThem ? "Stop following" : "Follow"}
        onClick={(e) => {
          e.stopPropagation();
          if (followingThem) editor.stopFollowingUser();
          else editor.startFollowingUser(userId);
        }}
      >
        {followingThem ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export const boardUiComponents: TLComponents = {
  SharePanel: NanocoreSharePanel,
};
