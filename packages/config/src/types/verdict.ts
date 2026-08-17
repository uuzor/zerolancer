import type { Hex } from "viem";

/// On-chain AI verification verdict (matches ZeroLanceTeeVerifier.Verdict).
export interface Verdict {
  taskId: bigint;
  deliverableHash: Hex;
  passed: boolean;
  score: bigint; // 0..10000 bps
  nonce: Hex;
  validUntil: bigint;
  signature: Hex;
}

/// Off-chain verification result before EIP-712 signing.
export interface VerificationResult {
  taskId: bigint;
  deliverableHash: Hex;
  passed: boolean;
  score: bigint;
  reason: string;
  artifacts: VerificationArtifact[];
}

export interface VerificationArtifact {
  kind: "ci" | "lint" | "coverage" | "ml-brand" | "llm-similarity" | "community";
  label: string;
  passed: boolean;
  detail: string;
  metric?: number; // e.g. coverage %, similarity score
}

export interface VerdictInput {
  taskId: bigint;
  deliverableHash: Hex;
  passed: boolean;
  score: bigint;
  nonce?: Hex;
  validUntilSeconds?: number;
}
