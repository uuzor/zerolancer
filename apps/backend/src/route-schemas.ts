import { z } from "zod";
import { hexViem, addressViem, bytes32Viem } from "@zerolance/config/types/hex";

export const createTaskSchema = z.object({
  specHash: bytes32Viem,
  category: z.enum(["Code", "Design", "Content", "Community"]),
  paymentToken: addressViem,
  reward: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  deadline: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  repoUrl: z.string().min(1).max(512),
  issueNumber: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  coverageGateBps: z.number().int().min(0).max(10_000).default(8000),
});

export const assignTaskSchema = z.object({
  freelancer: addressViem,
});

export const submitDeliverableSchema = z.object({
  deliverableRef: z.string().min(1).max(2048), // PR URL / file hash / URL
  prNumber: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
});

export const depositSchema = z.object({
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
});

export const approveSchema = z.object({
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
});

export const verifySchema = z.object({
  deliverableRef: z.string().min(1).max(2048),
  taskId: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  repoUrl: z.string().max(512).optional(),
  prNumber: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  coverageGateBps: z.number().int().min(0).max(10_000).optional(),
});

/// The on-chain Verdict struct submitted to EscrowVault.submitVerdict.
/// Must match the tuple (uint256,bytes32,bool,uint256,bytes32,uint256,bytes).
export const verdictSchema = z.object({
  taskId: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  deliverableHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  passed: z.boolean(),
  score: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  validUntil: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export const submitVerdictSchema = z.object({
  verdict: verdictSchema,
});

export const voteSchema = z.object({
  choice: z.enum(["Client", "Freelancer", "Abstain"]),
});

export const escalateSchema = z.object({
  arbiters: z.array(addressViem).min(1).max(20),
});

export const stakeSchema = z.object({
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
});

export const eventBodySchema = z.object({
  source: z.string().min(1).max(128),
  eventName: z.string().min(1).max(128),
  chainId: z.number().int().positive(),
  blockNumber: z.number().int().nonnegative(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/).optional(),
  logIndex: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
});
