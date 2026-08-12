/**
 * Accept custom color style values (custom-1 … custom-N) used by the web client.
 *
 * The board UI injects those keys into the color theme and writes them on shapes.
 * Without the same validation looseness on the sync server, TLSocketRoom rejects
 * the records as INVALID_RECORD and the board disconnects.
 */
import { DefaultColorStyle } from "@tldraw/tlschema";

function isCustomColorKey(value: unknown): boolean {
  return typeof value === "string" && /^custom-\d+$/.test(value);
}

function patchStyle(style: {
  validate: (value: unknown) => unknown;
  validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
}): void {
  const marked = style as { __nanocoreColorPatch?: boolean };
  if (marked.__nanocoreColorPatch) return;
  marked.__nanocoreColorPatch = true;

  const orig = style.validate.bind(style);
  style.validate = (value: unknown) => {
    if (isCustomColorKey(value)) return value;
    return orig(value);
  };

  if (style.validateUsingKnownGoodVersion) {
    const origKnown = style.validateUsingKnownGoodVersion.bind(style);
    style.validateUsingKnownGoodVersion = (prev: unknown, next: unknown) => {
      if (isCustomColorKey(next)) return next;
      return origKnown(prev, next);
    };
  }
}

let done = false;

/** Call once before any TLSocketRoom is created. */
export function patchColorStylesForSync(): void {
  if (done) return;
  done = true;
  // Sticky notes, geo, draw, etc. all use DefaultColorStyle for props.color
  patchStyle(DefaultColorStyle as never);
}