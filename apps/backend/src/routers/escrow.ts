import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import { depositSchema, approveSchema } from "../route-schemas.js";
import type { ServerConfig } from "../server.js";
import { sendError, extractErrorMessage } from "../utils/response.js";
import { HTTP } from "@zerolance/config";

export function registerEscrowRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/escrow/approve",
    schema: approveSchema,
    consumer: "escrow.approve",
    description: "Encode ERC20 approve calldata so the client can approve the vault before deposit",
  }, async (parsed) => {
    const token = config.escrowClient?.paymentToken;
    if (!token) throw new Error("payment token not configured");
    const calldata = token.iface.encodeFunctionData("approve", [
      config.addresses.escrowVault,
      BigInt(parsed.amount),
    ]);
    return { calldata, to: config.addresses.mockUsdc };
  }, config);

  createRoute(app, {
    path: "/v1/escrow/deposit",
    schema: depositSchema,
    consumer: "escrow.deposit",
    description: "Deposit USDC into escrow for a task",
    broadcast: "Deposited",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const escrow = config.escrowClient?.escrow;
    if (!escrow) throw new Error("escrow not configured");
    const calldata = escrow.iface.encodeFunctionData("deposit", [
      BigInt(taskId),
      BigInt(parsed.amount),
    ]);
    return { calldata, to: config.addresses.escrowVault };
  }, config);

  createRoute(app, {
    path: "/v1/escrow/:id",
    method: "get",
    consumer: "escrow.status",
    description: "Get escrow status for a task",
    requireId: true,
  }, async (_parsed, req, res) => {
    const taskId = BigInt(req.params.id ?? "0");
    const client = config.escrowClient;
    if (!client) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "escrow not configured");
      return null;
    }
    const [escrowed, released] = await Promise.all([
      client.escrowedOf(taskId),
      client.releasedOf(taskId),
    ]);
    return { taskId: taskId.toString(), escrowed: escrowed.toString(), released };
  }, config);

  createRoute(app, {
    path: "/v1/escrow/refund",
    consumer: "escrow.refund",
    description: "Refund escrowed funds to the client (operator-only)",
  }, async (_parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const escrow = config.escrowClient?.escrow;
    if (!escrow) throw new Error("escrow not configured");
    const calldata = escrow.iface.encodeFunctionData("refund", [BigInt(taskId)]);
    return { calldata, to: config.addresses.escrowVault };
  }, config);
}
