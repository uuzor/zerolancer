import type { StoredEventPayload } from "./payloads.js";

export interface StoredEvent {
  source: string;
  chainId: number;
  blockNumber: number;
  txHash: string | null;
  logIndex: number;
  eventName: string;
  payload: StoredEventPayload;
  receivedAt: number;
  timestamp: number;
}

export type StoredEventInput = Omit<StoredEvent, "receivedAt" | "timestamp"> & {
  receivedAt?: number;
  timestamp?: number;
};

export interface TaskEventQuery {
  taskId: string;
  eventName?: string;
  source?: string;
  limit?: number;
}
