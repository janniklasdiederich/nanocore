/**
 * Mask-style kanban icon for tldraw (opaque shapes on transparent).
 * Three columns — distinct from frame and note tools.
 */
const KANBAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black">
  <rect x="3" y="4" width="5" height="16" rx="1.2"/>
  <rect x="9.5" y="4" width="5" height="11" rx="1.2"/>
  <rect x="16" y="4" width="5" height="14" rx="1.2"/>
</svg>`;

export const KANBAN_TOOL_ICON_ID = "tool-kanban";
export const KANBAN_TOOL_ICON_URL = `data:image/svg+xml,${encodeURIComponent(KANBAN_SVG)}`;
