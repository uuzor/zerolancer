import OpenAI from "openai";
import { ARISTOTLE_CHAIN_ID, pickOGNetwork } from "@zerolance/config/networks";
import { createLogger } from "../utils/logger.js";

const log = createLogger("compute-router");
const ROUTER_TIMEOUT_MS = 30_000;

export function resolveChainId(chainId?: number): number {
  if (chainId !== undefined) return chainId;
  const env = Number(process.env.ZERO_CHAIN_ID);
  return Number.isFinite(env) && env > 0 ? env : ARISTOTLE_CHAIN_ID;
}

export function getComputeBaseUrl(): string {
  const explicit =
    process.env.ZERO_COMPUTE_BASE_URL ?? process.env.OG_COMPUTE_BASE_URL;
  if (explicit) return explicit;
  const chainId = resolveChainId();
  const network = pickOGNetwork(chainId);
  return network?.computeRouterUrl ?? "https://router-api.0g.ai/v1";
}

export interface RouterClientOptions {
  timeout?: number;
}

/// 0G Compute router client (OpenAI-compatible). Used by the VerdictOrchestrator
/// for AI scoring (content similarity, design brand-compliance, code review).
export async function createRouterClient(
  model?: string,
  opts: RouterClientOptions = {},
): Promise<OpenAI> {
  const timeout = opts.timeout ?? ROUTER_TIMEOUT_MS;
  log.info("Creating router client", { model });

  const directKey = process.env.ZERO_COMPUTE_DIRECT_KEY;
  if (directKey) {
    const directBase =
      process.env.ZERO_COMPUTE_DIRECT_URL ??
      "https://compute-network-6.integratenetwork.work/v1/proxy";
    return new OpenAI({ baseURL: directBase, apiKey: directKey, timeout, maxRetries: 0 });
  }

  const routerKey = process.env.ZERO_COMPUTE_API_KEY ?? process.env.OG_COMPUTE_API_KEY;
  if (routerKey) {
    return new OpenAI({ baseURL: getComputeBaseUrl(), apiKey: routerKey, timeout, maxRetries: 0 });
  }

  throw new Error("ZERO_COMPUTE_API_KEY or OG_COMPUTE_API_KEY required");
}
