import type { Router, Request, Response } from "express";
import { HTTP } from "@zerolance/config";
import { REGISTERED_ROUTES } from "./route-factory.js";
import { getEventStore } from "../events/store.js";
import type { ServerConfig } from "../server.js";
import { resolveRpcUrl } from "@zerolance/config";

export function registerHealthRoutes(app: Router, config: ServerConfig): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      version: "0.1.0",
      signer: config.signerAddress ?? null,
      oracle: config.oracleClient ? "configured" : "not-configured",
      escrow: config.escrowClient ? "configured" : "not-configured",
      wave: {
        escrow: config.waveEscrowClient ? "configured" : "not-configured",
        verifier: config.waveVerifierClient ? "configured" : "not-configured",
        oss: config.ossWaveClient ? "configured" : "not-configured",
        buildathon: config.buildathonWaveClient ? "configured" : "not-configured",
      },
      storage: config.storageService.backend,
      da: config.daPublisher ? "configured" : "not-configured",
      events: getEventStore().size,
    });
  });

  app.get("/v1/config", (_req: Request, res: Response) => {
    res.json({
      chainId: config.chainId,
      rpcUrl: resolveRpcUrl(config.chainId),
      addresses: config.addresses,
      routes: REGISTERED_ROUTES,
    });
  });
}
