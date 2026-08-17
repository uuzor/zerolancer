import { z } from "zod";
import { sharedEnvSchema } from "@zerolance/config/env-schema";
import { hexString } from "@zerolance/config/types/hex";

export const oracleEnvSchema = sharedEnvSchema.merge(
  z.object({
    ZERO_ORACLE_URL: z.string().url().optional(),
    ZERO_ORACLE_PORT: z.coerce.number().int().positive().default(8787),
    ZERO_ORACLE_BIND: z.string().default("0.0.0.0"),
    ZERO_TEE_VERIFIER_ADDRESS: z.string().optional(),
    ZERO_TEE_VERIFIER: z.string().optional(),
    ZERO_TEE_SIGNER_PK: hexString.or(z.string().regex(/^[0-9a-fA-F]{64}$/).transform((v) => `0x${v}`)),
    ZERO_STORAGE_INDEXER_RPC: z.string().url().optional(),
    ZERO_STORAGE_EVM_RPC: z.string().url().optional(),
    ZERO_STORAGE_PRIVATE_KEY: z.string().optional(),
    ZERO_ALLOW_CLEARTEXT_DEK: z.string().optional(),
  }),
);
export type OracleEnv = z.infer<typeof oracleEnvSchema>;
