import type { Hex } from "viem";
export declare enum VoteChoice {
    Client = "Client",
    Freelancer = "Freelancer",
    Abstain = "Abstain"
}
export interface Dispute {
    taskId: bigint;
    quorum: number;
    clientVotes: number;
    freelancerVotes: number;
    abstainVotes: number;
    arbiterCount: number;
    resolved: boolean;
    winner: Hex;
    createdAt: number;
}
//# sourceMappingURL=dispute.d.ts.map