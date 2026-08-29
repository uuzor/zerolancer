import type { Hex } from "viem";
export interface IntelligentData {
    dataDescription: string;
    dataHash: Hex;
}
export interface ReputationNft {
    tokenId: bigint;
    freelancer: Hex;
    taskId: bigint;
    datas: IntelligentData[];
}
export interface VerifiedBadge {
    freelancer: Hex;
    stake: bigint;
    isVerified: boolean;
    unstakeReadyAt: number;
}
//# sourceMappingURL=reputation.d.ts.map