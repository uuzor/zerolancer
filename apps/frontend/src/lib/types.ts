export type TaskStatus = "Open" | "Assigned" | "InReview" | "Passed" | "Disputed" | "Resolved" | "Cancelled";
export type TaskCategory = "Code" | "Design" | "Content" | "Community";
export type WaveStatus = "None" | "Open" | "Evaluation" | "Finalized" | "Closed";
export type IssueState = "Created" | "Claimed" | "PrSubmitted" | "Awarded" | "Closed";

export interface Task {
  taskId: string;
  client: string;
  freelancer: string;
  status: TaskStatus;
  category: TaskCategory;
  specHash: string;
  deliverableHash: string;
  paymentToken: string;
  reward: string;
  deadline: string;
  createdAt: string;
  retryDeadline: string;
  repoUrl: string;
  issueNumber: string;
  prNumber: string;
  coverageGateBps: string;
}

export interface WaveProgram {
  programId: string;
  token: string;
  organizer: string;
  genesisPool: string;
  numWaves: string;
  buildWindow: string;
  evalWindow: string;
  complimentWindow: string;
  budgetMethod: string;
  feeBps: string;
  treasury: string;
  currentWave: string;
  waveSeq: string;
}

export interface Wave {
  programId: string;
  status: WaveStatus;
  buildEndAt: string;
  evalEndAt: string;
  complimentEndAt: string;
  budget: string;
  totalDistributed: string;
  finalized: boolean;
}

export interface WaveIssue {
  issueId: string;
  programId: string;
  waveId: string;
  maintainer: string;
  builder: string;
  specHash: string;
  repoHash: string;
  basePoints: string;
  bonusPoints: string;
  deliveredPr: string;
  deliverableHash: string;
  complexity: string;
  state: IssueState;
  pointsAwarded: boolean;
}

export interface ReputationNft {
  tokenId: string;
  owner: string;
  taskId: string;
  dataDescription: string;
  dataHash: string;
}

export interface Dispute {
  taskId: string;
  quorum: string;
  clientVotes: string;
  freelancerVotes: string;
  abstainVotes: string;
  arbiterCount: string;
  resolved: boolean;
  winner: string;
  createdAt: string;
}

export interface Verdict {
  taskId: string;
  deliverableHash: string;
  passed: boolean;
  score: string;
  nonce: string;
  validUntil: string;
  signature: string;
}

export interface VerificationResult {
  verdict: Verdict;
  verification: {
    score: string;
    reason: string;
    artifacts?: Record<string, any>;
  };
  signer: string;
}

export interface EventMessage {
  id: string;
  source: string;
  eventName: string;
  chainId: string;
  blockNumber: string;
  txHash?: string;
  logIndex?: string;
  payload: Record<string, any>;
  createdAt: string;
}
