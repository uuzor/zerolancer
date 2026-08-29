import type { Hex } from "viem";
export interface Verdict {
    taskId: bigint;
    deliverableHash: Hex;
    passed: boolean;
    score: bigint;
    nonce: Hex;
    validUntil: bigint;
    signature: Hex;
}
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
    metric?: number;
}
export interface VerdictInput {
    taskId: bigint;
    deliverableHash: Hex;
    passed: boolean;
    score: bigint;
    nonce?: Hex;
    validUntilSeconds?: number;
}
//# sourceMappingURL=verdict.d.ts.map