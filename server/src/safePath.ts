import { resolve, sep } from "node:path";

/**
 * Resolve `requestPath` under `root`, rejecting absolute segments and `..` escapes.
 * `requestPath` is a URL pathname (e.g. `/assets/app.js`).
 */
export function safePathUnderRoot(
  root: string,
  requestPath: string,
): string | null {
  if (!requestPath || requestPath.includes("\0")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  // Strip leading slashes → relative to root
  const relative = decoded.replace(/^[/\\]+/, "");
  if (!relative) return null;

  const parts = relative.split(/[/\\]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  if (parts.some((p) => p === "." || p === "..")) return null;

  const rootResolved = resolve(root);
  const full = resolve(rootResolved, ...parts);

  const prefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep;
  if (full !== rootResolved && !full.startsWith(prefix)) {
    return null;
  }

  return full;
}
