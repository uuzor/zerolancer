import type { WebSocket } from "ws";

export interface ConnectedClient {
  socket: WebSocket;
  topics: Set<string>;
  missedPings: number;
}

const clients = new Set<ConnectedClient>();

export function registerClient(client: ConnectedClient): void {
  clients.add(client);
}

export function unregisterClient(client: ConnectedClient): void {
  clients.delete(client);
}

export function getClients(): Set<ConnectedClient> {
  return clients;
}

/// Broadcast a payload to all subscribers of a topic. Non-fatal on send errors.
export function broadcast(topic: string, payload: unknown): void {
  if (clients.size === 0) return;
  const msg = JSON.stringify({ topic, payload, ts: Date.now() });
  for (const c of clients) {
    if (c.socket.readyState !== c.socket.OPEN) continue;
    if (c.topics.size > 0 && !c.topics.has(topic)) continue;
    try {
      c.socket.send(msg);
    } catch {
      // send failures are non-fatal; the heartbeat loop will reap dead sockets
    }
  }
}
