import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { api, ApiError } from "./api";
import { syncWsBase } from "./config";

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

export type DocSyncStatus = "connecting" | "connected" | "disconnected";

export function connectDocSync(opts: {
  docId: string;
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  onStatus?: (status: DocSyncStatus) => void;
  onSynced?: () => void;
}): () => void {
  const { docId, ydoc, awareness, onStatus, onSynced } = opts;
  let closed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let synced = false;

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  };

  const onAwareness = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === "remote") return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const changed = changes.added.concat(changes.updated, changes.removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
    );
    ws.send(encoding.toUint8Array(encoder));
  };

  ydoc.on("update", onDocUpdate);
  awareness.on("update", onAwareness);

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** attempt, 8000);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  }

  function handleMessage(raw: ArrayBuffer) {
    const decoder = decoding.createDecoder(new Uint8Array(raw));
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        const syncType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          ydoc,
          "remote",
        );
        if (encoding.length(encoder) > 1 && ws?.readyState === WebSocket.OPEN) {
          ws.send(encoding.toUint8Array(encoder));
        }
        if (syncType === syncProtocol.messageYjsSyncStep2 && !synced) {
          synced = true;
          onSynced?.();
        }
        break;
      }
      case messageQueryAwareness: {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            awareness,
            Array.from(awareness.getStates().keys()),
          ),
        );
        ws.send(encoding.toUint8Array(encoder));
        break;
      }
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          decoding.readVarUint8Array(decoder),
          "remote",
        );
        break;
      }
      default:
        break;
    }
  }

  async function connect() {
    if (closed) return;
    onStatus?.("connecting");
    try {
      const { token } = await api.getDocSyncToken(docId);
      if (closed) return;
      const sessionId = crypto.randomUUID();
      const url = `${syncWsBase()}/api/doc-sync/${encodeURIComponent(docId)}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
      ws = socket;

      socket.addEventListener("open", () => {
        if (closed || ws !== socket) return;
        attempt = 0;
        onStatus?.("connected");
        const step1 = encoding.createEncoder();
        encoding.writeVarUint(step1, messageSync);
        syncProtocol.writeSyncStep1(step1, ydoc);
        socket.send(encoding.toUint8Array(step1));
        if (awareness.getLocalState() !== null) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, [
              ydoc.clientID,
            ]),
          );
          socket.send(encoding.toUint8Array(encoder));
        }
      });

      socket.addEventListener("message", (event) => {
        if (closed || ws !== socket) return;
        if (event.data instanceof ArrayBuffer) {
          try {
            handleMessage(event.data);
          } catch (err) {
            console.error("[docs] sync message failed", err);
          }
        }
      });

      socket.addEventListener("close", (event) => {
        if (ws === socket) ws = null;
        if (closed) return;
        onStatus?.("disconnected");
        if (event.code === 4403 || event.code === 1008) return;
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    } catch (err) {
      if (closed) return;
      onStatus?.("disconnected");
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403 || err.status === 404)
      ) {
        return;
      }
      scheduleReconnect();
    }
  }

  void connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ydoc.off("update", onDocUpdate);
    awareness.off("update", onAwareness);
    try {
      ws?.close();
    } catch {
      // ignore
    }
    ws = null;
  };
}
