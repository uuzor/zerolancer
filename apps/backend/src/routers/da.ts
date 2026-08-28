import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { getEventStore } from "../events/store.js";

/// Register Data-Availability REST endpoints (anchored event batches).
export function registerDaRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/da/publish",
    consumer: "da.publish",
    description: "Flush pending events as a single DA-anchored 0G Storage batch",
  }, async (_p, _req, res) => {
    if (!config.daPublisher) {
      res.status(503).json({ ok: false, error: "DA publisher not configured", code: "DA_NOT_CONFIGURED" });
      return null;
    }
    const commitment = await config.daPublisher.flush();
    return { ok: true, commitment: commitment ?? null };
  }, config);

  createRoute(app, {
    path: "/v1/da/commitments",
    method: "get",
    consumer: "da.commitments",
    description: "List recent DA batch commitments",
  }, async (_p, _req, res) => {
    const commitments = config.daPublisher?.recentCommitments ?? [];
    return { commitments };
  }, config);

  createRoute(app, {
    path: "/v1/da/summary",
    method: "get",
    consumer: "da.summary",
    description: "DA status summary (commits, pending queue, local event counts)",
  }, async (_p, _req, res) => {
    const store = getEventStore();
    const commitments = config.daPublisher?.recentCommitments ?? [];
    return {
      enabled: !!config.daPublisher,
      pending: config.daPublisher?.pendingCount ?? 0,
      anchoredBatches: commitments.length,
      lastRoot: commitments.at(-1)?.batchRoot ?? null,
      localEvents: store.size,
      commitments: commitments.slice(-20),
    };
  }, config);
}