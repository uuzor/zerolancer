import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  return val === "" ? undefined : val;
}

export const sharedEnvSchema = z.object({
  ZERO_FRONTEND_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_API_KEY: z.string().optional(),
  ZERO_COMPUTE_API_KEY: z.preprocess((val) => {
    if (val === undefined || val === "") {
      return process.env.OG_COMPUTE_API_KEY ?? undefined;
    }
    return val;
  }, z.string().optional()),
  ZERO_CHAIN_ID: z.coerce.number().int().positive().default(16661),
  OG_COMPUTE_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_EVM_RPC: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_ORACLE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_TEE_SIGNER_PK: z.string().optional(),
  ZERO_SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_COMPUTE_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_DISABLE_AUTH: z.string().optional(),
  ZERO_COMPUTE_DIRECT_KEY: z.string().optional(),
  ZERO_COMPUTE_DIRECT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ZERO_CLIENT_API_KEY: z.string().optional(),
  ZERO_EVENT_SOURCES: z.string().optional(),
  ZERO_HEALTH_CACHE_MS: z.coerce.number().int().positive().optional(),
  ZERO_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  ZERO_CHAT_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  ZERO_DATA_DIR: z.string().optional(),
  // GitHub runner config
  ZERO_TASK_ESCROW_ADDRESS: z.string().optional(),
  ZERO_TASK_VERIFIER_ADDRESS: z.string().optional(),
  ZERO_WAVE_VAULT_ADDRESS: z.string().optional(),
  // Deprecated aliases (kept for backward compatibility)
  ZERO_WAVE_ESCROW_ADDRESS: z.string().optional(),
  ZERO_WAVE_VERIFIER_ADDRESS: z.string().optional(),
  ZERO_OSS_WAVE_ADDRESS: z.string().optional(),
  ZERO_BUILDATHON_WAVE_ADDRESS: z.string().optional(),
});
