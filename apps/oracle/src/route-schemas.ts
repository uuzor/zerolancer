import { z } from "zod";
import { hexViem } from "@zerolance/config/types/hex";

export const verdictSignBodySchema = z.object({
  taskId: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  deliverableHash: hexViem,
  passed: z.boolean(),
  score: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  nonce: hexViem.optional(),
  validUntil: z.union([z.string(), z.number()]).optional(),
});

export const rekeyBodySchema = z.object({
  oldDataHash: hexViem,
  oldDataUri: hexViem,
  targetPubkey64: hexViem,
  nonce: z.union([z.string(), z.number()]),
  to: z.string(),
  nft: z.string(),
  sealedDataEncryptionKey: z.string().optional(),
  oldDataEncryptionKey: z.string().optional(),
  validUntil: z.union([z.string(), z.number()]).optional(),
});

export const mintDataHashSchema = z.object({
  dataHash: hexViem,
});
