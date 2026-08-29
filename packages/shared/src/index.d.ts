import type { Hex } from "viem";
import type { VerificationArtifact, VerificationResult } from "@zerolance/config";
export declare function specHashOf(spec: TaskSpecInput): Hex;
export interface TaskSpecInput {
    title: string;
    category: number;
    paymentToken: Hex;
    reward: bigint;
    deadline: number;
    repoUrl: string;
    issueNumber: number;
    coverageGateBps: number;
}
export declare function deliverableHashOf(ref: string): Hex;
export declare function computeScore(artifacts: VerificationArtifact[], coverageGateBps: number): {
    score: bigint;
    passed: boolean;
};
export declare function buildVerificationResult(taskId: bigint, deliverableRef: string, artifacts: VerificationArtifact[], coverageGateBps: number): VerificationResult;
export declare function taskTopic(taskId: bigint | string): string;
export declare function disputeTopic(taskId: bigint | string): string;
export declare const MINT_SEEN_TAG: string;
//# sourceMappingURL=index.d.ts.map