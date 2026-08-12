import type { Editor, TLShape, TLShapeId } from "tldraw";

export const REACTIONS_META = "nanocoreReactions";

export const REACTION_EMOJI = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "👀",
  "🔥",
  "👎",
  "💯",
] as const;

export type ReactionMap = Record<string, string[]>;

export function readReactions(shape: TLShape): ReactionMap {
  const raw = shape.meta[REACTIONS_META];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ReactionMap = {};
  for (const [emoji, users] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(users)) continue;
    const ids = users.filter((id): id is string => typeof id === "string");
    if (ids.length) out[emoji] = ids;
  }
  return out;
}

export function toggleReaction(
  editor: Editor,
  shapeId: TLShapeId,
  emoji: string,
  userId: string,
): void {
  const shape = editor.getShape(shapeId);
  if (!shape) return;
  const current = readReactions(shape);
  const users = current[emoji] ?? [];
  const nextUsers = users.includes(userId)
    ? users.filter((id) => id !== userId)
    : [...users, userId];
  const next: ReactionMap = { ...current };
  if (nextUsers.length) next[emoji] = nextUsers;
  else delete next[emoji];

  editor.updateShape({
    id: shape.id,
    type: shape.type,
    meta: {
      ...shape.meta,
      [REACTIONS_META]: next,
    },
  });
}
