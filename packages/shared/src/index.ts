import { id, keccak256, toUtf8Bytes, AbiCoder } from "ethers";
import type { Hex } from "viem";
import type {
  VerificationArtifact,
  VerificationResult,
} from "@zerolance/config";

/// Canonical ABI encoding of a task spec for on-chain immutability.
/// The spec is encrypted and uploaded to 0G Storage; this hash is the on-chain anchor.
export function specHashOf(spec: TaskSpecInput): Hex {
  const encoded = new AbiCoder().encode(
    ["string", "uint8", "address", "uint256", "uint256", "string", "uint64", "uint16"],
    [
      spec.title,
      spec.category,
      spec.paymentToken,
      spec.reward,
      spec.deadline,
      spec.repoUrl,
      spec.issueNumber,
      spec.coverageGateBps,
    ],
  );
  return keccak256(encoded) as Hex;
}

export interface TaskSpecInput {
  title: string;
  category: number; // TaskCategory enum ordinal
  paymentToken: Hex;
  reward: bigint;
  deadline: number;
  repoUrl: string;
  issueNumber: number;
  coverageGateBps: number;
}

/// Hash a deliverable reference (PR URL / file hash / URL) for on-chain submission.
export function deliverableHashOf(ref: string): Hex {
  return keccak256(toUtf8Bytes(ref)) as Hex;
}

/// Compute a 0..10000 (bps) verification score from artifacts.
/// Pass requires every gate artifact to pass AND the aggregate score >= the gate.
export function computeScore(
  artifacts: VerificationArtifact[],
  coverageGateBps: number,
): { score: bigint; passed: boolean } {
  if (artifacts.length === 0) return { score: 0n, passed: false };
  let sum = 0;
  let allPassed = true;
  for (const a of artifacts) {
    if (!a.passed) allPassed = false;
    if (a.metric !== undefined) sum += a.metric;
  }
  const avg = Math.round(sum / artifacts.length);
  const score = BigInt(Math.min(10_000, avg));
  // Coverage gate applies when a coverage artifact is present.
  const coverage = artifacts.find((a) => a.kind === "coverage");
  const coverageOk = coverage ? (coverage.metric ?? 0) >= coverageGateBps : true;
  return { score, passed: allPassed && coverageOk && score >= BigInt(coverageGateBps) };
}

/// Build the final VerificationResult that the oracle signs.
export function buildVerificationResult(
  taskId: bigint,
  deliverableRef: string,
  artifacts: VerificationArtifact[],
  coverageGateBps: number,
): VerificationResult {
  const { score, passed } = computeScore(artifacts, coverageGateBps);
  return {
    taskId,
    deliverableHash: deliverableHashOf(deliverableRef),
    passed,
    score,
    reason: passed
      ? `All gates passed (score ${score}).`
      : `Verification failed (score ${score}, gate ${coverageGateBps}).`,
    artifacts,
  };
}

/// Stable topic string for a task's WebSocket event stream.
export function taskTopic(taskId: bigint | string): string {
  return `task:${taskId.toString()}`;
}

export function disputeTopic(taskId: bigint | string): string {
  return `dispute:${taskId.toString()}`;
}

/// Sentinel used by the oracle to mark a dataHash as seen before minting.
export const MINT_SEEN_TAG = id("ZeroLanceMintSeen");
