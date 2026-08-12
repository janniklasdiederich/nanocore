import { useEffect, useState } from "react";
import type { Editor, TLShape } from "tldraw";

export const OWNER_META = "nanocoreOwner";
export const OWNER_LABEL_STORAGE_KEY = "nanocore_ownerLabel";

export type ShapeOwner = { id: string; name: string };
export type OwnerLabelMode = "always" | "never" | "hover";

/** Stickies, text, images/GIFs, geo shapes. Not arrows, pen, frames, lines, etc. */
const OWNER_LABEL_TYPES = new Set(["note", "text", "image", "geo"]);

export function shapeShowsOwner(shape: TLShape): boolean {
  return OWNER_LABEL_TYPES.has(shape.type);
}

const OWNER_LABEL_MODES: readonly OwnerLabelMode[] = [
  "always",
  "never",
  "hover",
];

const listeners = new Set<() => void>();

function isOwnerLabelMode(value: unknown): value is OwnerLabelMode {
  return (
    typeof value === "string" &&
    (OWNER_LABEL_MODES as readonly string[]).includes(value)
  );
}

export function readOwner(shape: TLShape): ShapeOwner | null {
  const raw = shape.meta[OWNER_META];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== "string" || typeof rec.name !== "string") return null;
  const name = rec.name.trim();
  if (!rec.id || !name) return null;
  return { id: rec.id, name };
}

/**
 * Stamp the current user as owner on locally created shapes (draw, paste, duplicate).
 * Remote sync creates are left untouched so peers keep their own stamps.
 */
export function registerShapeOwnerStamp(
  editor: Editor,
  owner: { id: string; name: string },
): () => void {
  return editor.sideEffects.registerBeforeCreateHandler(
    "shape",
    (shape, source) => {
      if (source !== "user") return shape;
      if (!shapeShowsOwner(shape)) return shape;
      const name = owner.name.trim();
      if (!owner.id || !name) return shape;
      return {
        ...shape,
        meta: {
          ...shape.meta,
          [OWNER_META]: { id: owner.id, name },
        },
      };
    },
  );
}

export function getOwnerLabelMode(): OwnerLabelMode {
  try {
    const stored = localStorage.getItem(OWNER_LABEL_STORAGE_KEY);
    if (isOwnerLabelMode(stored)) return stored;
  } catch {
    // ignore
  }
  return "hover";
}

export function setOwnerLabelMode(mode: OwnerLabelMode): void {
  try {
    localStorage.setItem(OWNER_LABEL_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}

export function subscribeOwnerLabelMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOwnerLabelMode(): OwnerLabelMode {
  const [mode, setMode] = useState(getOwnerLabelMode);
  useEffect(() => subscribeOwnerLabelMode(() => setMode(getOwnerLabelMode())), []);
  return mode;
}
