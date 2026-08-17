import type { Server } from "node:http";
import type { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "../utils/logger.js";
import { registerClient, unregisterClient } from "./broadcaster.js";

const log = createLogger("ws");

export function attachWebsocket(server: Server, _app: Express): void {
  const wss = new WebSocketServer({ noServer: true });
  const HEARTBEAT_MS = 30_000;

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: WebSocket, req) => {
    const topics = parseTopicsFromUrl(req.url);
    const client = { socket, topics, missedPings: 0 };
    registerClient(client);
    log.info("ws client connected", { clients: wss.clients.size });

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribe" && Array.isArray(msg.topics)) {
          for (const t of msg.topics) {
            if (typeof t === "string") client.topics.add(t);
          }
          socket.send(JSON.stringify({ type: "subscribed", topics: [...client.topics] }));
        } else if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
      } catch {
        /* ignore malformed messages */
      }
    });

    socket.on("close", () => {
      unregisterClient(client);
      log.info("ws client disconnected", { clients: wss.clients.size });
    });
    socket.on("error", () => {
      unregisterClient(client);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if ((ws as WebSocket & { isAlive?: boolean }).isAlive === false) {
        ws.terminate();
        continue;
      }
      (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));
}

/// Topics are passed via query string (?topics=TaskCreated,Released).
function parseTopicsFromUrl(url: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!url) return set;
  const q = url.split("?")[1];
  if (!q) return set;
  for (const pair of q.split("&")) {
    const [key, value] = pair.split("=");
    if (key === "topics" && value) {
      for (const t of value.split(",")) {
        if (t) set.add(t);
      }
    }
  }
  return set;
}
