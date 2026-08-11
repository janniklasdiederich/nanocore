/**
 * Client API / WebSocket base URLs.
 *
 * Priority:
 *  1. Runtime `window.__NANOCORE_CONFIG__` (written by start:web from env)
 *  2. Build-time `import.meta.env.VITE_*` (baked by Vite)
 *  3. Same-origin (or localhost:3001 in pure dev)
 */

export type NanocoreRuntimeConfig = {
  apiUrl?: string;
  wsUrl?: string;
};

declare global {
  interface Window {
    __NANOCORE_CONFIG__?: NanocoreRuntimeConfig;
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function runtime(): NanocoreRuntimeConfig {
  if (typeof window === "undefined") return {};
  return window.__NANOCORE_CONFIG__ ?? {};
}

/** API origin without trailing slash, or "" for same-origin relative /api. */
export function apiOrigin(): string {
  const fromRuntime = runtime().apiUrl?.trim();
  if (fromRuntime) return trimSlash(fromRuntime);

  const fromBuild = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromBuild) return trimSlash(fromBuild);

  return "";
}

/** Prefix a path like `/api/boards` with the API origin when set. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${p}` : p;
}

/** WebSocket origin for tldraw sync (no path). */
export function syncWsBase(): string {
  const fromRuntime = runtime().wsUrl?.trim();
  if (fromRuntime) return trimSlash(fromRuntime);

  const fromBuild = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (fromBuild) return trimSlash(fromBuild);

  const api = apiOrigin();
  if (api) {
    const u = new URL(api);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.origin;
  }

  // Same host as the page only when UI+API are one origin (e.g. bun serve SPA)
  if (import.meta.env.PROD) {
    // If we're on a typical Vite preview port, prefer default API port — last-resort
    // hint for misconfigured deploys (runtime config should have been set).
    const host = window.location.hostname;
    const port = window.location.port;
    if (port === "4173" || port === "5173") {
      console.warn(
        "[nanocore] No VITE_API_URL / runtime config — guessing API at :3001. " +
          "Set VITE_API_URL and restart start:web (or rebuild).",
      );
      return `ws://${host}:3001`;
    }
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}`;
  }

  return "ws://localhost:3001";
}
