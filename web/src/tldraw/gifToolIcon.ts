/**
 * Mask-style GIF icon for tldraw (opaque shapes on transparent).
 * Film strip + play mark — distinct from the image/media tool.
 */
const GIF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black">
  <path fill-rule="evenodd" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm1.5 2v10h13V7h-13z"/>
  <circle cx="6.4" cy="9.2" r=".85"/>
  <circle cx="6.4" cy="12" r=".85"/>
  <circle cx="6.4" cy="14.8" r=".85"/>
  <circle cx="17.6" cy="9.2" r=".85"/>
  <circle cx="17.6" cy="12" r=".85"/>
  <circle cx="17.6" cy="14.8" r=".85"/>
  <path d="M10.4 9.1 15.6 12l-5.2 2.9z"/>
</svg>`;

export const GIF_TOOL_ICON_ID = "tool-gif";
export const GIF_TOOL_ICON_URL = `data:image/svg+xml,${encodeURIComponent(GIF_SVG)}`;
