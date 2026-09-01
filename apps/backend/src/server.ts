import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Server } from "node:http";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { Wallet } from "ethers";
import type { InterfaceAbi } from "ethers";

import { HTTP, type AddressName } from "@zerolance/config";
import {
  ZEROLANCE_ESCROW_VAULT_ABI,
  ZEROLANCE_TASK_REGISTRY_ABI,
  ZEROLANCE_ARBITRATION_ABI,
  ZEROLANCE_REPUTATION_NFT_ABI,
  ZEROLANCE_WAVE_PROGRAM_ABI,
  ZEROLANCE_WAVE_ISSUE_ABI,
  ZEROLANCE_WAVE_BUILDATHON_ABI,
} from "@zerolance/config";
import {
  createApiKeyAuth,
  enforceClientPathAllowlist,
} from "@zerolance/config/middleware/auth";
import { loadEnv } from "@zerolance/config/env";
import { getAddresses } from "@zerolance/config/addresses";
import { ZodError } from "zod";

import { getSharedProvider } from "./provider.js";
import { registerHealthRoutes } from "./routers/health.js";
import { registerTaskRoutes } from "./routers/task.js";
import { registerEscrowRoutes } from "./routers/escrow.js";
import { registerVerificationRoutes } from "./routers/verification.js";
import { registerDisputeRoutes } from "./routers/dispute.js";
import { registerReputationRoutes } from "./routers/reputation.js";
import { registerEventRoutes } from "./routers/events.js";
import { registerGithubRoutes } from "./routers/github.js";
import { registerComputeRoutes } from "./routers/compute.js";
import { registerWaveRoutes } from "./routers/wave.js";
import { registerStorageRoutes } from "./routers/storage.js";
import { registerDaRoutes } from "./routers/da.js";
import { attachWebsocket } from "./ws/handler.js";
import { DefaultOracleClient, type OracleClient } from "./oracle/client.js";
import { EscrowClient } from "./escrow/client.js";
import { WaveClient } from "./wave/client.js";
import { StorageService } from "./storage/service.js";
import { DaPublisher } from "./da/publisher.js";
import { VerdictOrchestrator } from "./compute/verdict-orchestrator.js";
import { GithubRunner } from "./github/runner.js";
import { GithubClient } from "./github/client.js";
import { Indexer } from "./indexer/index.js";
import { createLogger } from "./utils/logger.js";
import { backendEnvSchema, type BackendEnv } from "./env-schema.js";
import { extractErrorMessage } from "./utils/response.js";
import { getEventStore } from "./events/store.js";
import { registerProcessHandlers } from "@zerolance/config/process";

const log = createLogger("server");

export interface ServerConfig {
  env: BackendEnv;
  chainId: number;
  addresses: Partial<Record<AddressName, `0x${string}`>>;
  oracleClient: OracleClient | null;
  escrowClient: EscrowClient | null;
  verdictOrchestrator: VerdictOrchestrator | null;
  waveClient: WaveClient | null;
  storageService: StorageService;
  daPublisher: DaPublisher | null;
  indexers: Indexer[];
  signerAddress: `0x${string}` | null;
}

export async function createApp(env: BackendEnv): Promise<{
  app: Express;
  server: Server;
  config: ServerConfig;
}> {
  loadEnv();
  if (env.ZERO_SENTRY_DSN) {
    Sentry.init({ dsn: env.ZERO_SENTRY_DSN, environment: process.env.NODE_ENV ?? "development" });
  }

  const chainId = env.ZERO_CHAIN_ID;
  const provider = getSharedProvider(chainId);

  const addresses = getAddresses({
    MOCK_USDC_ADDRESS: env.ZERO_MOCK_USDC_ADDRESS,
    USDC_ADDRESS: env.ZERO_MOCK_USDC_ADDRESS,
    ZERO_TOKEN_ADDRESS: env.ZERO_TOKEN_ADDRESS,
    ZERO_TEE_VERIFIER_ADDRESS: env.ZERO_TEE_VERIFIER_ADDRESS,
    ZERO_TEE_VERIFIER: env.ZERO_TEE_VERIFIER_ADDRESS,
    ZERO_TASK_REGISTRY_ADDRESS: env.ZERO_TASK_REGISTRY_ADDRESS,
    TASK_REGISTRY_ADDRESS: env.ZERO_TASK_REGISTRY_ADDRESS,
    ZERO_ESCROW_VAULT_ADDRESS: env.ZERO_ESCROW_VAULT_ADDRESS,
    ESCROW_VAULT_ADDRESS: env.ZERO_ESCROW_VAULT_ADDRESS,
    ZERO_ARBITRATION_ADDRESS: env.ZERO_ARBITRATION_ADDRESS,
    ARBITRATION_ADDRESS: env.ZERO_ARBITRATION_ADDRESS,
    ZERO_REPUTATION_NFT_ADDRESS: env.ZERO_REPUTATION_NFT_ADDRESS,
    REPUTATION_NFT_ADDRESS: env.ZERO_REPUTATION_NFT_ADDRESS,
  }) as Partial<Record<AddressName, `0x${string}`>>;

  let signer: Wallet | undefined;
  const pk = env.ZERO_RUNTIME_SIGNER_PK ?? env.ZERO_OPERATOR_PK;
  if (pk) {
    try {
      signer = new Wallet(pk, provider);
    } catch (err) {
      log.warn("invalid runtime signer pk", { error: extractErrorMessage(err) });
    }
  }

  let oracleClient: OracleClient | null = null;
  if (env.ZERO_ORACLE_URL) {
    oracleClient = new DefaultOracleClient({
      baseUrl: env.ZERO_ORACLE_URL,
      apiKey: env.ZERO_API_KEY,
    });
  }

  let escrowClient: EscrowClient | null = null;
  if (addresses.escrowVault && addresses.taskRegistry && addresses.mockUsdc) {
    escrowClient = new EscrowClient({
      escrowAddress: addresses.escrowVault,
      taskRegistryAddress: addresses.taskRegistry,
      paymentTokenAddress: addresses.mockUsdc,
      provider,
      signer,
    });
  }

  let verdictOrchestrator: VerdictOrchestrator | null = null;
  if (oracleClient) {
    const runner = new GithubRunner(
      env.ZERO_VERIFICATION_TIMEOUT_MS,
      env.ZERO_SANDBOX_IMAGE,
    );
    const githubClient = new GithubClient({
      clientId: env.ZERO_GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.ZERO_GITHUB_OAUTH_CLIENT_SECRET,
      redirectUri: env.ZERO_GITHUB_OAUTH_REDIRECT_URI,
      pat: env.ZERO_GITHUB_TOKEN,
    });
    verdictOrchestrator = new VerdictOrchestrator(
      oracleClient,
      runner,
      8000,
      githubClient,
    );
  }

  // Wave funding stack (optional until the contract is deployed).
  let waveClient: WaveClient | null = null;
  const waveProgram = env.ZERO_WAVE_PROGRAM_ADDRESS as `0x${string}` | undefined;
  if (waveProgram) {
    waveClient = new WaveClient({
      waveProgramAddress: waveProgram,
      provider,
      signer,
    });
    log.info("WaveClient configured", { waveProgram });
  }

  // 0G Storage service for artifact blobs (real 0G when signer + storage RPC set).
  const storageService = new StorageService({
    storageRpc: env.ZERO_STORAGE_RPC,
    evmRpc: env.ZERO_EVM_RPC,
    signerPk: pk,
  });

  // DA publisher anchors appended events as content-addressed 0G Storage blobs.
  const daPublisher = new DaPublisher(storageService, {
    maxBatchEvents: env.ZERO_DA_MAX_BATCH_EVENTS,
    flushIntervalMs: env.ZERO_DA_FLUSH_INTERVAL_MS,
  });
  getEventStore().setDaPublisher(daPublisher);
  await daPublisher.start();

  const indexers: Indexer[] = [];
  {
    const { Contract } = await import("ethers");
    const pollWindowBlocks = env.INDEXER_POLL_WINDOW_BLOCKS;
    const startBlock = env.INDEXER_START_BLOCK;

    type IndexerDef = {
      address: `0x${string}` | undefined;
      abi: InterfaceAbi;
      source: string;
    };
    const defs: IndexerDef[] = [
      {
        address: addresses.taskRegistry,
        abi: [...ZEROLANCE_TASK_REGISTRY_ABI],
        source: "task-registry",
      },
      {
        address: addresses.escrowVault,
        abi: [...ZEROLANCE_ESCROW_VAULT_ABI],
        source: "escrow",
      },
      {
        address: addresses.arbitration,
        abi: [...ZEROLANCE_ARBITRATION_ABI],
        source: "arbitration",
      },
      {
        address: addresses.reputationNft,
        abi: [...ZEROLANCE_REPUTATION_NFT_ABI],
        source: "reputation",
      },
      {
        address: (env.ZERO_WAVE_PROGRAM_ADDRESS as `0x${string}` | undefined),
        abi: [...ZEROLANCE_WAVE_PROGRAM_ABI],
        source: "wave-program",
      },
      {
        address: (env.ZERO_WAVE_ISSUE_ADDRESS as `0x${string}` | undefined),
        abi: [...ZEROLANCE_WAVE_ISSUE_ABI],
        source: "wave-issue",
      },
      {
        address: (env.ZERO_WAVE_BUILDATHON_ADDRESS as `0x${string}` | undefined),
        abi: [...ZEROLANCE_WAVE_BUILDATHON_ABI],
        source: "wave-buildathon",
      },
    ];
    for (const def of defs) {
      if (!def.address) continue;
      indexers.push(
        new Indexer({
          contract: new Contract(def.address, [...def.abi], provider),
          source: def.source,
          provider,
          chainId,
          pollWindowBlocks,
          startBlock,
        }),
      );
    }
  }

  const signerAddress =
    (env.ZERO_RUNTIME_SIGNER_PK ?? env.ZERO_OPERATOR_PK)
      ? new Wallet(env.ZERO_RUNTIME_SIGNER_PK ?? env.ZERO_OPERATOR_PK!).address as `0x${string}`
      : null;

  const config: ServerConfig = {
    env,
    chainId,
    addresses,
    oracleClient,
    escrowClient,
    verdictOrchestrator,
    waveClient,
    storageService,
    daPublisher,
    indexers,
    signerAddress,
  };

  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", env.ZERO_FRONTEND_URL ?? "http://localhost:5173"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.ZERO_FRONTEND_URL ?? "http://localhost:5173" }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    (res.locals as { requestId?: string }).requestId = randomUUID();
    next();
  });
  app.use(
    createApiKeyAuth(
      env.ZERO_API_KEY,
      ["/health", "/v1/config", "/v1/github/auth/start", "/v1/github/auth/callback", "/v1/github/webhook"],
      env.ZERO_DISABLE_AUTH === "true",
      env.ZERO_CLIENT_API_KEY,
    ),
  );
  app.use(enforceClientPathAllowlist);
  app.use(rateLimit({ windowMs: 60_000, max: env.ZERO_RATE_LIMIT_MAX }));

  const router = express.Router();
  registerHealthRoutes(router, config);
  registerTaskRoutes(router, config);
  registerEscrowRoutes(router, config);
  registerVerificationRoutes(router, config);
  registerDisputeRoutes(router, config);
  registerReputationRoutes(router, config);
  registerEventRoutes(router, config);
  registerGithubRoutes(router, config);
  registerComputeRoutes(router, config);
  registerWaveRoutes(router, config);
  registerStorageRoutes(router, config);
  registerDaRoutes(router, config);
  app.use(router);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res
        .status(HTTP.BAD_REQUEST)
        .json({ error: err.issues[0]?.message ?? "Validation error" });
      return;
    }
    // Never echo raw error strings (engine text, RPC payloads, stack lines).
    const message = extractErrorMessage(err);
    log.error("request failed", { error: message });
    res.status(HTTP.INTERNAL).json({ error: "internal server error", code: "INTERNAL_ERROR" });
  });

  const server = app.listen(env.ZERO_PORT, env.ZERO_BIND, () => {
    log.info("backend listening", { bind: env.ZERO_BIND, port: env.ZERO_PORT });
  });

  attachWebsocket(server, app);

  for (const idx of indexers) {
    void idx.start().catch((err) => {
      log.warn("indexer failed to start", { error: extractErrorMessage(err) });
    });
  }

  registerProcessHandlers();

  const shutdown = (sig: string) => {
    log.info(`${sig} received — shutting down`);
    for (const idx of indexers) idx.stop();
    if (daPublisher) {
      void daPublisher.flush().catch(() => {
        /* best-effort final anchor */
      });
      daPublisher.stop();
    }
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
    void getEventStore().flush();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return { app, server, config };
}

export { backendEnvSchema };
export type { BackendEnv };
