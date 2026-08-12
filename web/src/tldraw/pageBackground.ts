import type { Editor, TLPage, TLPageId } from "tldraw";

/** Default canvas color (tldraw-like light grey). */
export const DEFAULT_PAGE_BACKGROUND = "#f2f3f5";

export const PAGE_BACKGROUND_PRESETS = [
  "#f2f3f5", // light grey (default)
  "#ffffff", // white
  "#1a1d24", // dark
  "#0f172a", // slate
  "#ecfdf5", // mint
  "#eff6ff", // sky
  "#fef3c7", // warm
  "#fce7f3", // rose
] as const;

const META_KEY = "backgroundColor";
/** Previous board-global key — used as fallback once for migration. */
const LEGACY_DOCUMENT_META_KEY = "backgroundColor";

function isHexColor(value: unknown): value is string {
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
  return DEFAULT_PAGE_BACKGROUND;
}

export function getPageBackgroundColor(
  editor: Editor,
  page?: TLPage | TLPageId | null,
): string {
  const resolved =
    typeof page === "string"
      ? editor.getPage(page)
      : page ?? editor.getCurrentPage();

  if (resolved) {
    const fromPage = resolved.meta?.[META_KEY];
    if (isHexColor(fromPage)) return fromPage;
  }

  // One-time-ish fallback: older boards stored color on document.meta
  const legacy = editor.getDocumentSettings().meta?.[LEGACY_DOCUMENT_META_KEY];
  if (isHexColor(legacy)) return legacy;

  return DEFAULT_PAGE_BACKGROUND;
}

export function setPageBackgroundColor(
  editor: Editor,
  pageId: TLPageId,
  color: string,
): void {
  if (!isHexColor(color)) return;
  const page = editor.getPage(pageId);
  if (!page) return;

  editor.updatePage({
    id: pageId,
    meta: {
      ...page.meta,
      [META_KEY]: color,
    },
  });
}
