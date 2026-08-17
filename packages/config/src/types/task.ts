import type { Hex } from "viem";

export enum TaskStatus {
  Open = "Open",
  Assigned = "Assigned",
  InReview = "InReview",
  Passed = "Passed",
  Disputed = "Disputed",
  Resolved = "Resolved",
  Cancelled = "Cancelled",
}

export enum TaskCategory {
  Code = "Code",
  Design = "Design",
  Content = "Content",
  Community = "Community",
}

export interface Task {
  taskId: bigint;
  client: Hex;
  freelancer: Hex | null;
  status: TaskStatus;
  category: TaskCategory;
  specHash: Hex;
  deliverableHash: Hex | null;
  paymentToken: Hex;
  reward: bigint;
  deadline: number;
  createdAt: number;
  retryDeadline: number;
  repoUrl: string;
  issueNumber: number;
  prNumber: number;
  coverageGateBps: number;
}

export interface CreateTaskInput {
  specHash: Hex;
  category: TaskCategory;
  paymentToken: Hex;
  reward: bigint;
  deadline: number;
  repoUrl: string;
  issueNumber: number;
  coverageGateBps: number;
  /// Encrypted spec blob (uploaded to 0G Storage by the backend before createTask).
  specCiphertext?: Uint8Array;
}
