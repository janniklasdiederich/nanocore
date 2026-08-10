import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  getUserFromToken,
  SESSION_COOKIE,
  verifySyncToken,
  type Variables,
} from "./auth";
import { env } from "./env";
import { isSetupComplete } from "./db";
import { makeOrLoadRoom, getActiveRoom, closeAllRooms } from "./rooms";
import { setupRoutes } from "./routes/setup";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { boardRoutes } from "./routes/boards";
import { assetRoutes } from "./routes/assets";

type WsData = {
  sessionId: string;
  boardId: string;
  userId: string;
};

const app = new Hono<{ Variables: Variables }>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  }),
);

app.get("/api/health", (c) =>
  c.json({ ok: true, setupComplete: isSetupComplete() }),
);

app.route("/api/setup", setupRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/boards", boardRoutes);
app.route("/api/assets", assetRoutes);

// Production: serve Vite build
const webDist = env.webDist;
if (existsSync(webDist)) {
  app.get("*", async (c) => {
    const path = new URL(c.req.url).pathname;
    if (path.startsWith("/api")) {
      return c.json({ error: "Not found" }, 404);
    }

    const filePath = join(webDist, path === "/" ? "index.html" : path);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback
    const index = Bun.file(join(webDist, "index.html"));
    if (await index.exists()) {
      return new Response(index, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return c.text("Web UI not built. Run: bun run build", 404);
  });
} else {
  app.get("/", (c) =>
    c.text(
      "Nanocore API is running. Start the web app with: bun run dev:web",
    ),
  );
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

const server = Bun.serve<WsData>({
  port: env.port,
  hostname: env.host,
  async fetch(req, srv) {
    const url = new URL(req.url);

    // WebSocket upgrade for tldraw sync
    if (url.pathname.startsWith("/api/sync/")) {
      const isUpgrade =
        req.headers.get("upgrade")?.toLowerCase() === "websocket";
      if (!isUpgrade) {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const boardId = decodeURIComponent(
        url.pathname.slice("/api/sync/".length).split("/")[0] ?? "",
      );
      // tldraw client always appends sessionId — do not invent it on the client
      const sessionId = url.searchParams.get("sessionId");
      const syncToken = url.searchParams.get("token");

      if (!boardId || !sessionId) {
        console.warn("[sync] missing boardId or sessionId");
        return new Response("Missing boardId or sessionId", { status: 400 });
      }

      let userId: string | null = null;

      if (syncToken) {
        const verified = verifySyncToken(syncToken, boardId);
        if (!verified) {
          console.warn("[sync] invalid or expired sync token");
          return new Response("Unauthorized", { status: 401 });
        }
        userId = verified.userId;
      } else {
        const cookies = parseCookies(req.headers.get("cookie"));
        const cookieToken = cookies[SESSION_COOKIE];
        const user = getUserFromToken(cookieToken);
        if (!user) {
          console.warn("[sync] no cookie session");
          return new Response("Unauthorized", { status: 401 });
        }
        if (user.must_change_password) {
          return new Response("Password change required", { status: 403 });
        }
        userId = user.id;
      }

      const board = (
        await import("./db")
      ).db
        .query("SELECT id FROM boards WHERE id = ?")
        .get(boardId);
      if (!board) {
        return new Response("Board not found", { status: 404 });
      }

      const ok = srv.upgrade(req, {
        data: {
          sessionId,
          boardId,
          userId,
        },
      });
      if (!ok) {
        console.error("[sync] Bun upgrade failed");
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
      // Successful upgrade: do not return a Response body
      return undefined as unknown as Response;
    }

    return app.fetch(req, srv);
  },
  websocket: {
    open(ws) {
      try {
        const room = makeOrLoadRoom(ws.data.boardId);
        // Bun.serve sockets: use handleSocketMessage/Close instead of event listeners.
        room.handleSocketConnect({
          sessionId: ws.data.sessionId,
          socket: {
            send: (data) => {
              try {
                ws.send(data);
              } catch {
                // socket may already be closed
              }
            },
            close: (code?: number, reason?: string) => {
              try {
                ws.close(code, reason);
              } catch {
                // ignore
              }
            },
            get readyState() {
              return ws.readyState;
            },
          },
        });
      } catch (err) {
        console.error("WS open error", err);
        ws.close(1011, "Room error");
      }
    },
    message(ws, message) {
      try {
        const room = makeOrLoadRoom(ws.data.boardId);
        const data =
          typeof message === "string"
            ? message
            : message instanceof ArrayBuffer
              ? message
              : message.buffer.slice(
                  message.byteOffset,
                  message.byteOffset + message.byteLength,
                );
        room.handleSocketMessage(ws.data.sessionId, data as string | ArrayBuffer);
      } catch (err) {
        console.error("WS message error", err);
      }
    },
    close(ws) {
      const room = getActiveRoom(ws.data.boardId);
      if (room) {
        room.handleSocketClose(ws.data.sessionId);
      }
    },
  },
});

console.log(`Nanocore listening on http://${env.host}:${server.port}`);
console.log(`  data: ${env.dataDir}`);

process.on("SIGINT", () => {
  closeAllRooms();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeAllRooms();
  server.stop();
  process.exit(0);
});
