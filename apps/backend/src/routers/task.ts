import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import {
  createTaskSchema,
  assignTaskSchema,
  submitDeliverableSchema,
} from "../route-schemas.js";
import type { ServerConfig } from "../server.js";
import { HTTP } from "@zerolance/config";
import { sendError } from "../utils/response.js";

export function registerTaskRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/tasks/create",
    schema: createTaskSchema,
    consumer: "task.create",
    description: "Create an on-chain task (specHash anchored, encrypted spec on 0G)",
    broadcast: "TaskCreated",
  }, async (parsed) => {
    // Task creation is a client-signed on-chain tx; the backend returns the
    // encoded calldata + next task id for the client to submit.
    const registry = config.escrowClient?.taskRegistry;
    if (!registry) {
      throw new Error("task registry not configured");
    }
    const iface = registry.iface;
    const categoryMap: Record<string, number> = {
      Code: 0,
      Design: 1,
      Content: 2,
      Community: 3,
    };
    const calldata = iface.encodeFunctionData("createTask", [
      parsed.specHash,
      categoryMap[parsed.category],
      parsed.paymentToken,
      BigInt(parsed.reward),
      BigInt(parsed.deadline),
      parsed.repoUrl,
      BigInt(parsed.issueNumber),
      parsed.coverageGateBps,
    ]);
    return {
      calldata,
      to: config.addresses.taskRegistry,
      nextTaskId: (await config.escrowClient!.nextTaskId()).toString(),
    };
  }, config);

  createRoute(app, {
    path: "/v1/tasks/assign",
    schema: assignTaskSchema,
    consumer: "task.assign",
    description: "Assign a freelancer to a task",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const registry = config.escrowClient?.taskRegistry;
    if (!registry) throw new Error("task registry not configured");
    const calldata = registry.iface.encodeFunctionData("assignTask", [
      BigInt(taskId),
      parsed.freelancer,
    ]);
    return { calldata, to: config.addresses.taskRegistry };
  }, config);

  createRoute(app, {
    path: "/v1/tasks/submit",
    schema: submitDeliverableSchema,
    consumer: "task.submit",
    description: "Submit a deliverable (PR URL) for verification",
    broadcast: "DeliverableSubmitted",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const { deliverableHashOf } = await import("@zerolance/shared");
    const deliverableHash = deliverableHashOf(parsed.deliverableRef);
    const registry = config.escrowClient?.taskRegistry;
    if (!registry) throw new Error("task registry not configured");
    const calldata = registry.iface.encodeFunctionData("submitDeliverable", [
      BigInt(taskId),
      deliverableHash,
      BigInt(parsed.prNumber ?? 0),
    ]);
    return { calldata, to: config.addresses.taskRegistry, deliverableHash };
  }, config);
}
