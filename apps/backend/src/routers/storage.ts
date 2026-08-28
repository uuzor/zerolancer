import type { Router, Response } from "express";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { HTTP } from "@zerolance/config";
import { sendError } from "../utils/response.js";

const uploadJsonSchema = z.object({
  value: z.unknown(),
});

/// Register 0G Storage REST endpoints (upload + retrieve artifacts).
export function registerStorageRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/storage/upload-json",
    schema: uploadJsonSchema,
    consumer: "storage.uploadJson",
    description: "Upload a JSON value to 0G Storage and return its content root",
  }, async (parsed, _req, res) => {
    const stored = await config.storageService.uploadJson(parsed.value);
    return { rootHash: stored.rootHash, size: stored.size, backend: stored.backend };
  }, config);

  createRoute(app, {
    path: "/v1/storage/download/:rootHash",
    method: "get",
    consumer: "storage.download",
    description: "Download a blob from 0G Storage by root hash",
  }, async (_p, req, res) => {
    const rootHash = req.params.rootHash as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
      sendError(res, HTTP.BAD_REQUEST, "invalid rootHash", "INVALID_ROOT_HASH");
      return null;
    }
    const data = await config.storageService.download(rootHash);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(data.length));
    res.send(Buffer.from(data));
    return undefined;
  }, config);

  createRoute(app, {
    path: "/v1/storage/status",
    method: "get",
    consumer: "storage.status",
    description: "Report the active storage backend + upload count",
  }, async (_p, _req, res) => {
    return { ...config.storageService.stats, downloadEndpoint: "/v1/storage/download/:rootHash" };
  }, config);
}