import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import { voteSchema, escalateSchema } from "../route-schemas.js";
import type { ServerConfig } from "../server.js";
import { HTTP } from "@zerolance/config";
import { sendError } from "../utils/response.js";
import { getEventStore } from "../events/store.js";

export function registerDisputeRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/disputes/:id",
    method: "get",
    consumer: "dispute.status",
    description: "Get dispute status for a task",
    requireId: true,
  }, async (_parsed, req, res) => {
    const taskId = req.params.id ?? "";
    const store = getEventStore();
    const events = store.queryByTask({ taskId });
    const disputeEvents = events.filter(
      (e) => e.eventName === "DisputeOpened" || e.eventName === "VoteCast" || e.eventName === "DisputeResolved",
    );
    return { taskId, events: disputeEvents };
  }, config);

  createRoute(app, {
    path: "/v1/disputes/escalate",
    schema: escalateSchema,
    consumer: "dispute.escalate",
    description: "Escalate a task to arbitration (opens on-chain dispute with arbiters)",
    broadcast: "DisputeOpened",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const escrow = config.escrowClient?.escrow;
    if (!escrow) throw new Error("escrow not configured");
    const calldata = escrow.iface.encodeFunctionData("escalateDispute", [
      BigInt(taskId),
      parsed.arbiters,
    ]);
    return { calldata, to: config.addresses.escrowVault };
  }, config);

  createRoute(app, {
    path: "/v1/disputes/vote",
    schema: voteSchema,
    consumer: "dispute.vote",
    description: "Cast a vote as a staked arbiter",
    broadcast: "VoteCast",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    if (!config.addresses.arbitration) {
      throw new Error("arbitration not configured");
    }
    const voteMap: Record<string, number> = { Client: 0, Freelancer: 1, Abstain: 2 };
    // Build calldata for the arbitration contract (client submits on-chain).
    const { TypedContract } = await import("@zerolance/config/types/contract");
    const { ZEROLANCE_ARBITRATION_ABI } = await import("@zerolance/config");
    const arb = new TypedContract(
      config.addresses.arbitration,
      [...ZEROLANCE_ARBITRATION_ABI],
      null,
    );
    const calldata = arb.iface.encodeFunctionData("vote", [
      BigInt(taskId),
      voteMap[parsed.choice],
    ]);
    return { calldata, to: config.addresses.arbitration };
  }, config);
}
