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

  // Match tldraw default: only show when someone else is on the board
  if (!userIds.length) return null;

  return (
    <details className="nc-people-menu">
      <summary className="nc-people-menu__trigger" title="People on this board">
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
      </summary>
      <div className="nc-people-menu__panel">
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
            <PeerRow key={userId} userId={userId} />
          ))}
        </div>
      </div>
    </details>
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

function PeerRow({ userId }: { userId: string }) {
  const editor = useEditor();
  const presence = usePresence(userId);
  if (!presence) return null;

  const followingThem =
    editor.getInstanceState().followingUserId === userId;

  return (
    <button
      type="button"
      className="nc-people-menu__peer"
      title={
        followingThem
          ? "Double-click to stop following"
          : "Click to zoom · double-click to follow"
      }
      onClick={() => editor.zoomToUser(userId)}
      onDoubleClick={() => {
        if (followingThem) editor.stopFollowingUser();
        else editor.startFollowingUser(userId);
      }}
    >
      <span
        className="nc-people-menu__swatch"
        style={{ background: presence.color }}
      />
      <span className="nc-people-menu__name">
        {presence.userName?.trim() || "Anonymous"}
      </span>
      {followingThem && (
        <span className="nc-people-menu__following">following</span>
      )}
    </button>
  );
}

export const boardUiComponents: TLComponents = {
  SharePanel: NanocoreSharePanel,
};
