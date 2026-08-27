import type { Router } from "express";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { createRouterClient } from "../compute/index.js";
import { HTTP } from "@zerolance/config";
import { sendError } from "../utils/response.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("compute-router");

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
});

/// Register compute (0G inference) REST endpoints.
export function registerComputeRoutes(app: Router, config: ServerConfig): void {
  // -- List models -------------------------------------------------------
  createRoute(app, {
    path: "/v1/compute/models",
    method: "get",
    consumer: "compute.models",
    description: "List available 0G Compute models",
  }, async (_parsed, _req, res) => {
    if (!config.env.ZERO_COMPUTE_API_KEY) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "compute not configured", "COMPUTE_NOT_CONFIGURED");
      return null;
    }
    const client = await createRouterClient();
    const list = await client.models.list();
    const models: string[] = [];
    for await (const page of list) {
      models.push(page.id);
    }
    return { models };
  }, config);

  // -- Chat completion ---------------------------------------------------
  createRoute(app, {
    path: "/v1/compute/chat",
    schema: chatSchema,
    consumer: "compute.chat",
    description: "Proxy a chat-completion request through 0G Compute",
  }, async (req, _rq, res) => {
    if (!config.env.ZERO_COMPUTE_API_KEY) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "compute not configured", "COMPUTE_NOT_CONFIGURED");
      return null;
    }
    const model = req.model ?? config.env.ZERO_COMPUTE_MODEL ?? "0gm-1.0-35b-a3b";
    try {
      const client = await createRouterClient(model);
      const completion = await client.chat.completions.create({
        model,
        messages: req.messages.map((m) => ({ role: m.role as never, content: m.content })),
        temperature: req.temperature,
        max_tokens: req.maxTokens,
      });
      return {
        model: completion.model,
        choices: completion.choices.map((c) => ({
          index: c.index,
          role: c.message.role,
          content: c.message.content,
          finishReason: c.finish_reason,
        })),
        usage: completion.usage,
      };
    } catch (err) {
      // 0G router is an external dependency: surface the right recovery action
      // instead of leaking an internal 500.
      const message = err instanceof Error ? err.message : String(err);
      log.warn("compute chat upstream error", { error: message });
      const status = /401|Invalid API key/i.test(message)
        ? HTTP.UNAUTHORIZED
        : HTTP.BAD_GATEWAY;
      sendError(
        res,
        status,
        status === HTTP.UNAUTHORIZED
          ? "invalid or missing compute API key / insufficient inference credits"
          : "0G compute upstream error",
        status === HTTP.UNAUTHORIZED ? "COMPUTE_UNAUTHORIZED" : "COMPUTE_UPSTREAM_ERROR",
      );
      return null;
    }
  }, config);

  // Alias so clients hitting GET receive a clear message instead of a 404.
  createRoute(app, {
    path: "/v1/compute/providers",
    method: "get",
    consumer: "compute.providers",
    description: "List available 0G Compute providers (deprecated alias for models)",
  }, async (_parsed, _req, res) => {
    if (!config.env.ZERO_COMPUTE_API_KEY) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "compute not configured", "COMPUTE_NOT_CONFIGURED");
      return null;
    }
    const client = await createRouterClient();
    const list = await client.models.list();
    const models: string[] = [];
    for await (const page of list) {
      models.push(page.id);
    }
    return { providers: models };
  }, config);
}
