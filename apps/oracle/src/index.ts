import * as Sentry from "@sentry/node";
import { Wallet } from "ethers";

import { TeeSigner } from "./signer.js";
import { type Eip712Domain } from "@zerolance/config";
import {
  InMemoryStorage,
  ZeroGStorage,
  type StorageAdapter,
} from "@zerolance/config/storage/0g";
import { startServer } from "./server.js";
export { startServer, type ServerConfig } from "./server.js";
import { loadEnv } from "@zerolance/config/env";
import { oracleEnvSchema } from "./env-schema.js";
import { toViemHex } from "@zerolance/config/types/hex";
import { registerProcessHandlers } from "@zerolance/config/process";

loadEnv();
if (process.env.PORT) {
  process.env.ZERO_ORACLE_PORT = process.env.PORT;
}

const env = oracleEnvSchema.parse(process.env);
if (env.ZERO_SENTRY_DSN) {
  Sentry.init({
    dsn: env.ZERO_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
  });
}

const teeVerifierRaw = env.ZERO_TEE_VERIFIER_ADDRESS ?? env.ZERO_TEE_VERIFIER;
if (!teeVerifierRaw)
  throw new Error(
    "Missing ZERO_TEE_VERIFIER_ADDRESS or deprecated ZERO_TEE_VERIFIER",
  );
const teeVerifier: `0x${string}` = toViemHex(teeVerifierRaw);
const chainId = BigInt(env.ZERO_CHAIN_ID);
const eip712Domain: Eip712Domain = { chainId, verifyingContract: teeVerifier };
const signer = new TeeSigner(env.ZERO_TEE_SIGNER_PK, eip712Domain);

let storage: StorageAdapter;
if (env.ZERO_STORAGE_INDEXER_RPC || process.env.ZERO_STORAGE_RPC) {
  const indexerRpc =
    env.ZERO_STORAGE_INDEXER_RPC || process.env.ZERO_STORAGE_RPC!;
  const evmRpc = env.ZERO_STORAGE_EVM_RPC || env.ZERO_EVM_RPC || "";
  const storagePk = env.ZERO_STORAGE_PRIVATE_KEY ?? env.ZERO_TEE_SIGNER_PK;
  const wallet = new Wallet(storagePk);
  storage = new ZeroGStorage({ indexerRpc, evmRpc, signer: wallet });
  console.log(`[oracle] storage: 0G Storage (${indexerRpc})`);
} else {
  storage = new InMemoryStorage();
  console.log(
    "[oracle] storage: InMemoryStorage (no ZERO_STORAGE_INDEXER_RPC/ZERO_STORAGE_RPC configured)",
  );
}

const { httpServer: oracleHttp } = startServer({
  signer,
  storage,
  bind: env.ZERO_ORACLE_BIND,
  port: env.ZERO_ORACLE_PORT,
  env,
});

process.on("SIGTERM", () => {
  console.log("[oracle] SIGTERM received — draining connections...");
  oracleHttp.closeAllConnections?.();
  oracleHttp.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[oracle] SIGINT received — draining connections...");
  oracleHttp.closeAllConnections?.();
  oracleHttp.close(() => process.exit(0));
});

registerProcessHandlers();
