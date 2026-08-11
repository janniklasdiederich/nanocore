/**
 * Client config from Vite env (baked in at build time for production).
 *
 * VITE_API_URL — origin of the API, e.g. https://api.example.com or http://localhost:3001
 *                Leave empty when the UI is served from the same host as the API.
 * VITE_WS_URL  — optional override for board WebSockets (defaults from VITE_API_URL).
 */

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** API origin without trailing slash, or "" for same-origin relative /api. */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw?.trim()) return "";
  return trimSlash(raw.trim());
}

/** Prefix a path like `/api/boards` with VITE_API_URL when set. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${p}` : p;
}

/** WebSocket origin for tldraw sync (no path). */
export function syncWsBase(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv?.trim()) return trimSlash(fromEnv.trim());

  const api = apiOrigin();
  if (api) {
    const u = new URL(api);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.origin;
  }

  // Same host as the page (production single-process, or reverse proxy)
  if (import.meta.env.PROD) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}`;
  }

  // Vite dev: API is on 3001 by default
  return "ws://localhost:3001";
}
