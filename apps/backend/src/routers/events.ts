import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import { eventBodySchema } from "../route-schemas.js";
import type { ServerConfig } from "../server.js";
import { getEventStore } from "../events/store.js";

export function registerEventRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/events",
    method: "get",
    consumer: "events.list",
    description: "List recent indexed events",
  }, async (_parsed, req) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const since = req.query.since ? Number(req.query.since) : undefined;
    const eventName = req.query.eventName
      ? String(req.query.eventName)
      : undefined;
    const store = getEventStore();
    return store.getAll(limit, since, eventName);
  }, config);

  createRoute(app, {
    path: "/v1/events/:id",
    method: "get",
    consumer: "events.byTask",
    description: "List events for a specific task",
    requireId: true,
  }, async (_parsed, req) => {
    const taskId = req.params.id ?? "";
    const eventName = req.query.eventName
      ? String(req.query.eventName)
      : undefined;
    const store = getEventStore();
    return store.queryByTask({ taskId, eventName });
  }, config);

  createRoute(app, {
    path: "/v1/events/ingest",
    schema: eventBodySchema,
    consumer: "events.ingest",
    description: "Ingest a single event (for webhook sources)",
  }, async (parsed) => {
    const store = getEventStore();
    const stored = store.append({
      source: parsed.source,
      chainId: parsed.chainId,
      blockNumber: parsed.blockNumber,
      txHash: parsed.txHash ?? null,
      logIndex: parsed.logIndex,
      eventName: parsed.eventName,
      payload: parsed.payload,
    });
    return { ok: true, stored };
  }, config);
}
