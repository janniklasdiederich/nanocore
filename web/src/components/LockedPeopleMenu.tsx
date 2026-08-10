import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useEditor,
  usePeerIds,
  usePresence,
  useValue,
  type TLComponents,
} from "tldraw";
import { useT } from "../i18n";

/**
 * Share / people panel with a read-only display name.
 * Dropdown is portaled so it stacks above tldraw's style panel
 * (share zone lives under --layer-panels; menus need --layer-menus).
 */
function NanocoreSharePanel() {
  return (
    <div className="tlui-share-zone" draggable={false}>
      <NanocorePeopleMenu />
    </div>
  );
}

type PanelPos = { top: number; right: number };

function NanocorePeopleMenu() {
  const t = useT();
  const editor = useEditor();
  const userIds = usePeerIds();
  const userColor = useValue(
    "userColor",
    () => editor.user.getColor(),
    [editor],
  );
  const userName = useValue("userName", () => editor.user.getName(), [editor]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, userIds.length]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updatePosition();
    window.addEventListener("resize", onResize);
    // Capture scroll on any ancestor (tldraw may scroll containers)
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
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

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className="nc-people-menu__panel"
          role="menu"
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            // Above tldraw panels (300) and menus (400); below following indicator (1000)
            zIndex: 900,
          }}
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
                  {userName || t("people.you")}
                </div>
                <div className="nc-people-menu__hint">
                  {t("people.nameManaged")}
                </div>
              </div>
            </div>
          </div>
          <div className="nc-people-menu__section">
            {userIds.map((userId) => (
              <PeerRow key={userId} userId={userId} onActed={close} />
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="nc-people-menu">
      <button
        ref={triggerRef}
        type="button"
        className="nc-people-menu__trigger"
        title={t("people.title")}
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
      {panel}
    </div>
  );
}

function PeerAvatar({ userId }: { userId: string }) {
  const t = useT();
  const presence = usePresence(userId);
  if (!presence) return null;
  const letter = (presence.userName?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className="nc-people-menu__avatar"
      style={{ backgroundColor: presence.color }}
      title={presence.userName || t("board.anonymous")}
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
  const t = useT();
  const editor = useEditor();
  const presence = usePresence(userId);
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
        title={t("people.jump")}
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
          {presence.userName?.trim() || t("board.anonymous")}
        </span>
      </button>
      <button
        type="button"
        className={
          followingThem
            ? "nc-people-menu__follow nc-people-menu__follow--active"
            : "nc-people-menu__follow"
        }
        title={
          followingThem ? t("people.stopFollowing") : t("people.follow")
        }
        onClick={(e) => {
          e.stopPropagation();
          if (followingThem) editor.stopFollowingUser();
          else editor.startFollowingUser(userId);
        }}
      >
        {followingThem ? t("people.following") : t("people.follow")}
      </button>
    </div>
  );
}

export const boardUiComponents: TLComponents = {
  SharePanel: NanocoreSharePanel,
};
