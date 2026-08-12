/**
 * Custom shape colors for tldraw 3.15.
 *
 * Stock DefaultColorStyle is a fixed enum. We:
 * 1) Accept `custom-1`…`custom-N` in the style validator
 * 2) Inject hex entries into DefaultColorThemePalette (mutated in place so
 *    getDefaultColorTheme() callers pick them up)
 * 3) Persist the hex list on document.meta so multiplayer peers share the palette
 */
import {
  DefaultColorStyle,
  DefaultColorThemePalette,
  FrameShapeUtil,
  TLDOCUMENT_ID,
  type Editor,
  type TLDefaultColorThemeColor,
  type TLShape,
  type TLShapePartial,
} from "tldraw";

export const MAX_CUSTOM_COLORS = 16;
export const PALETTE_META_KEY = "nanocoreCustomColors";

export type CustomColorKey = `custom-${number}`;

let validationPatched = false;

/**
 * Allow custom-* values through DefaultColorStyle.
 * Must run **before** useSync validates remote shapes (see main.tsx import).
 *
 * tldraw's T.Validator.validate always calls internal `validationFn` — patching
 * only StyleProp.validate is not enough; we must patch type.validationFn.
 */
export function patchColorStyleValidation(): void {
  if (validationPatched) return;
  validationPatched = true;

  const s = DefaultColorStyle as unknown as {
    validate: (value: unknown) => unknown;
    validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
    type: {
      validationFn: (value: unknown) => unknown;
      validateUsingKnownGoodVersionFn?: (prev: unknown, next: unknown) => unknown;
      validate: (value: unknown) => unknown;
    };
  };

  const allowCustom = (value: unknown): unknown | undefined => {
    if (isCustomColorKey(value)) return value;
    return undefined;
  };

  // Primary path used by schema ObjectValidator → StyleProp.validate → type.validate
  // → type.validationFn
  if (s.type && typeof s.type.validationFn === "function") {
    const origFn = s.type.validationFn.bind(s.type);
    s.type.validationFn = (value: unknown) => {
      const custom = allowCustom(value);
      if (custom !== undefined) return custom;
      return origFn(value);
    };
  }

  if (s.type?.validateUsingKnownGoodVersionFn) {
    const origKnown = s.type.validateUsingKnownGoodVersionFn.bind(s.type);
    s.type.validateUsingKnownGoodVersionFn = (prev: unknown, next: unknown) => {
      const custom = allowCustom(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }

  // StyleProp.validate shortcut
  const origValidate = s.validate.bind(s);
  s.validate = (value: unknown) => {
    const custom = allowCustom(value);
    if (custom !== undefined) return custom;
    return origValidate(value);
  };
  if (s.validateUsingKnownGoodVersion) {
    const origKnown = s.validateUsingKnownGoodVersion.bind(s);
    s.validateUsingKnownGoodVersion = (prev: unknown, next: unknown) => {
      const custom = allowCustom(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }
}

/**
 * Frame color is a T.literalEnum of stock values (not DefaultColorStyle) so
 * the style panel can stay hidden unless showColors is on. Custom-* must be
 * allowed here or the store rejects colored frames on sync.
 */
function patchFrameColorValidation(): void {
  const color = (FrameShapeUtil.props as { color?: ColorValidatorLike }).color;
  if (!color) return;
  wrapColorValidator(color);
}

type ColorValidatorLike = {
  validate?: (value: unknown) => unknown;
  validationFn?: (value: unknown) => unknown;
  validateUsingKnownGoodVersion?: (prev: unknown, next: unknown) => unknown;
  validateUsingKnownGoodVersionFn?: (prev: unknown, next: unknown) => unknown;
};

function wrapColorValidator(validator: ColorValidatorLike): void {
  const allowCustom = (value: unknown): unknown | undefined => {
    if (isCustomColorKey(value)) return value;
    return undefined;
  };

  if (typeof validator.validationFn === "function") {
    const origFn = validator.validationFn.bind(validator);
    validator.validationFn = (value: unknown) => {
      const custom = allowCustom(value);
      if (custom !== undefined) return custom;
      return origFn(value);
    };
  }
  if (typeof validator.validateUsingKnownGoodVersionFn === "function") {
    const origKnown = validator.validateUsingKnownGoodVersionFn.bind(validator);
    validator.validateUsingKnownGoodVersionFn = (prev: unknown, next: unknown) => {
      const custom = allowCustom(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }
  if (typeof validator.validate === "function") {
    const origValidate = validator.validate.bind(validator);
    validator.validate = (value: unknown) => {
      const custom = allowCustom(value);
      if (custom !== undefined) return custom;
      return origValidate(value);
    };
  }
  if (typeof validator.validateUsingKnownGoodVersion === "function") {
    const origKnown = validator.validateUsingKnownGoodVersion.bind(validator);
    validator.validateUsingKnownGoodVersion = (prev: unknown, next: unknown) => {
      const custom = allowCustom(next);
      if (custom !== undefined) return custom;
      return origKnown(prev, next);
    };
  }
}

// Run at import time so the first sync put() already accepts custom-* colors
patchColorStyleValidation();
patchFrameColorValidation();

export function isCustomColorKey(value: unknown): value is CustomColorKey {
  return typeof value === "string" && /^custom-\d+$/.test(value);
}

export function isHexColor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
  );
}

export function normalizeHex6(hex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1]!;
    const g = hex[2]!;
    const b = hex[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "#888888";
}

function makeThemeColor(hex: string): TLDefaultColorThemeColor {
  const solid = normalizeHex6(hex);
  // ~50% alpha for semi fills
  const semi = solid.length === 7 ? `${solid}80` : solid;
  return {
    solid,
    semi,
    pattern: solid,
    fill: solid,
    frame: {
      headingStroke: solid,
      headingFill: semi,
      stroke: solid,
      fill: semi,
      text: solid,
    },
    note: {
      fill: semi,
      text: solid,
    },
    highlight: {
      srgb: solid,
      p3: solid,
    },
  };
}

/** Parse palette hex list from free-form document meta. */
export function parseCustomPalette(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isHexColor)
    .map(normalizeHex6)
    .slice(0, MAX_CUSTOM_COLORS);
}

export function readCustomPalette(editor: Editor): string[] {
  return parseCustomPalette(
    editor.getDocumentSettings().meta[PALETTE_META_KEY],
  );
}

export function writeCustomPalette(editor: Editor, hexes: string[]): void {
  const cleaned = hexes.map(normalizeHex6).slice(0, MAX_CUSTOM_COLORS);
  editor.store.update(TLDOCUMENT_ID, (doc) => ({
    ...doc,
    meta: {
      ...doc.meta,
      [PALETTE_META_KEY]: cleaned,
    },
  }));
  applyPaletteToTheme(cleaned);
}

const PLACEHOLDER_HEX = "#888888";

/**
 * Mutate the shared theme palette so custom-* keys always resolve.
 * Always seeds custom-1 … custom-MAX (placeholder if unused) so shapes never
 * hit theme[color] === undefined and crash with "Cannot read 'solid'/'note'".
 */
export function applyPaletteToTheme(hexes: string[]): void {
  const cleaned = hexes.map(normalizeHex6).slice(0, MAX_CUSTOM_COLORS);

  for (const mode of ["lightMode", "darkMode"] as const) {
    const theme = DefaultColorThemePalette[mode] as Record<string, unknown>;
    for (let i = 0; i < MAX_CUSTOM_COLORS; i++) {
      const hex = cleaned[i] ?? PLACEHOLDER_HEX;
      theme[`custom-${i + 1}`] = makeThemeColor(hex);
    }
  }
}

export function customKeyForIndex(index: number): CustomColorKey {
  return `custom-${index + 1}` as CustomColorKey;
}

/** Apply a palette slot (0-based) to selection + next shapes. */
export function applyCustomColorSlot(editor: Editor, slotIndex: number): void {
  const key = customKeyForIndex(slotIndex);
  const style = DefaultColorStyle as unknown as Parameters<
    Editor["setStyleForSelectedShapes"]
  >[0];

  editor.run(() => {
    if (editor.isIn("select") && editor.getSelectedShapeIds().length > 0) {
      editor.setStyleForSelectedShapes(style, key as never);
    }
    editor.setStyleForNextShapes(style, key as never);
    editor.updateInstanceState({ isChangingStyle: true });
  });
}

/** Add a hex to the palette and optionally apply it immediately. */
export function addCustomColor(
  editor: Editor,
  hex: string,
  opts?: { apply?: boolean },
): boolean {
  const palette = readCustomPalette(editor);
  if (palette.length >= MAX_CUSTOM_COLORS) return false;

  const next = normalizeHex6(hex);
  // Avoid exact duplicates
  if (palette.includes(next)) {
    if (opts?.apply !== false) {
      applyCustomColorSlot(editor, palette.indexOf(next));
    }
    return true;
  }

  const hexes = [...palette, next];
  editor.run(() => {
    writeCustomPalette(editor, hexes);
    if (opts?.apply !== false) {
      applyCustomColorSlot(editor, hexes.length - 1);
    }
  });
  return true;
}

/** Remove a palette slot; shapes using it fall back to black. */
export function removeCustomColor(editor: Editor, slotIndex: number): void {
  const palette = readCustomPalette(editor);
  if (slotIndex < 0 || slotIndex >= palette.length) return;

  const hexes = palette.filter((_, i) => i !== slotIndex);

  editor.run(() => {
    // Remap shapes that pointed at removed / shifted custom slots
    const updates: TLShapePartial[] = [];
    for (const record of editor.store.allRecords()) {
      if (record.typeName !== "shape") continue;
      const shape = record as TLShape;
      const props = shape.props as Record<string, unknown>;
      const nextProps: Record<string, unknown> = {};

      for (const prop of ["color", "labelColor"] as const) {
        const val = props[prop];
        if (!isCustomColorKey(val)) continue;
        const n = Number(val.slice("custom-".length));
        if (n === slotIndex + 1) {
          nextProps[prop] = "black";
        } else if (n > slotIndex + 1) {
          // Slot numbers after the removed one shift down
          nextProps[prop] = customKeyForIndex(n - 2);
        }
      }

      if (Object.keys(nextProps).length > 0) {
        updates.push({
          id: shape.id,
          type: shape.type,
          props: nextProps,
        } as TLShapePartial);
      }
    }
    if (updates.length) editor.updateShapes(updates);

    // Next-shape styles
    const stylesForNext = editor.getInstanceState().stylesForNextShape;
    const fixed: Record<string, unknown> = { ...stylesForNext };
    let dirty = false;
    for (const [id, value] of Object.entries(stylesForNext)) {
      if (!isCustomColorKey(value)) continue;
      dirty = true;
      const n = Number(value.slice("custom-".length));
      if (n === slotIndex + 1) fixed[id] = "black";
      else if (n > slotIndex + 1) fixed[id] = customKeyForIndex(n - 2);
    }
    if (dirty) {
      editor.updateInstanceState({
        stylesForNextShape: fixed as typeof stylesForNext,
      });
    }

    writeCustomPalette(editor, hexes);
  });
}

/** Sync theme from current document meta (call on mount + when meta changes). */
export function syncCustomColorsFromDocument(editor: Editor): void {
  patchColorStyleValidation();
  applyPaletteToTheme(readCustomPalette(editor));
}

/** Apply palette from a raw store (before Editor exists / first paint). */
export function syncCustomColorsFromStore(store: {
  get: (id: typeof TLDOCUMENT_ID) => { meta?: Record<string, unknown> } | undefined;
}): void {
  patchColorStyleValidation();
  const doc = store.get(TLDOCUMENT_ID);
  applyPaletteToTheme(parseCustomPalette(doc?.meta?.[PALETTE_META_KEY]));
}

/**
 * Keep theme in sync when document meta changes (remote collab palette edits).
 * Returns unsubscribe.
 */
export function listenCustomColorPalette(editor: Editor): () => void {
  syncCustomColorsFromDocument(editor);
  return editor.store.listen(
    () => {
      syncCustomColorsFromDocument(editor);
    },
    { source: "all", scope: "document" },
  );
}

// Seed placeholder custom-1…N so first paint never crashes
applyPaletteToTheme([]);
