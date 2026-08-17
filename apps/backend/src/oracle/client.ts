import {
  recoverVerdictSigner,
  type Eip712Domain,
  type VerdictProofInput,
  bigintReplacer,
} from "@zerolance/config";

const ORACLE_TIMEOUT_MS = 10_000;

export interface OracleClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  apiKey?: string;
}

export interface VerdictSignInput {
  taskId: bigint;
  deliverableHash: `0x${string}`;
  passed: boolean;
  score: bigint;
  nonce?: `0x${string}`;
  validUntil?: number;
}

export interface VerdictSignResult {
  signature: `0x${string}`;
  signer: `0x${string}`;
  nonce: `0x${string}`;
  validUntil: string;
}

export interface OracleClient {
  health(): Promise<{ ok: boolean; signer: `0x${string}`; version: string }>;
  signVerdict(input: VerdictSignInput): Promise<VerdictSignResult>;
}

/// HTTP client to the oracle (TEE signer) service. Adapted from axiom-protocol.
export class DefaultOracleClient implements OracleClient {
  private readonly baseUrl: string;

  constructor(private readonly config: OracleClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.config.apiKey) h["x-api-key"] = this.config.apiKey;
    return h;
  }

  health(): Promise<{ ok: boolean; signer: `0x${string}`; version: string }> {
    return this.get("/health");
  }

  signVerdict(input: VerdictSignInput): Promise<VerdictSignResult> {
    return this.post<VerdictSignResult>("/v1/verdict/sign", {
      taskId: input.taskId.toString(),
      deliverableHash: input.deliverableHash,
      passed: input.passed,
      score: input.score.toString(),
      nonce: input.nonce,
      validUntil: input.validUntil,
    });
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: object,
  ): Promise<T> {
    const timeout = this.config.timeoutMs ?? ORACLE_TIMEOUT_MS;
    const headers = this.headers(
      method === "POST" ? { "Content-Type": "application/json" } : undefined,
    );
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body, bigintReplacer) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Oracle ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private post<T>(path: string, input: object): Promise<T> {
    return this.request<T>("POST", path, input);
  }
}

/// Verify an oracle verdict signature locally before relaying it on-chain.
export function assertTrustedOracleVerdict(
  signature: `0x${string}`,
  input: VerdictProofInput,
  trustedSigner: `0x${string}`,
  domain: Eip712Domain,
): boolean {
  const recovered = recoverVerdictSigner(signature, input, domain);
  return recovered.toLowerCase() === trustedSigner.toLowerCase();
}

export type { VerdictProofInput, Eip712Domain };
