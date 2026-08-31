import { Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import { ZEROLANCE_OSS_WAVE_ABI } from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface OssWaveClientConfig {
  ossAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// OSS mode operations client. Maintainers create issues on accepted repos;
/// builders claim, submit PRs, earn base+compliment points on successful merge.
export class OssWaveClient {
  readonly oss: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly ossAddress: `0x${string}`;

  constructor(private readonly cfg: OssWaveClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.ossAddress = cfg.ossAddress;
    this.oss = new TypedContract(
      cfg.ossAddress,
      [...ZEROLANCE_OSS_WAVE_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("oss wave write requires a signer");
    return this.signer;
  }

  private async read<T>(method: string, args: unknown[]): Promise<T> {
    const fn = (this.oss.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T;
  }

  private async send(method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (this.oss.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    await tx.wait();
    return tx as unknown as Hex;
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  async issue(issueId: bigint): Promise<unknown> {
    return this.read("issue", [issueId]);
  }
  async acceptedRepo(programId: bigint, repoHash: `0x${string}`): Promise<boolean> {
    return this.read("acceptedRepo", [programId, repoHash]);
  }
  async isMaintainer(programId: bigint, who: `0x${string}`): Promise<boolean> {
    return this.read("isMaintainer", [programId, who]);
  }

  // ── Writes (signer-gated) ───────────────────────────────────────────────
  async acceptRepo(programId: bigint, repoHash: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send("acceptRepo", [programId, repoHash, allowed]);
  }
  async grantMaintainer(programId: bigint, who: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send("grantMaintainer", [programId, who, allowed]);
  }
  async createIssue(args: {
    programId: bigint;
    repoHash: `0x${string}`;
    specHash: `0x${string}`;
    basePoints: bigint;
    complexity: number;
  }): Promise<Hex> {
    return this.send("createIssue", [
      args.programId,
      args.repoHash,
      args.specHash,
      args.basePoints,
      args.complexity,
    ]);
  }
  async setIssuePoints(issueId: bigint, basePoints: bigint): Promise<Hex> {
    return this.send("setIssuePoints", [issueId, basePoints]);
  }
  async claimIssue(issueId: bigint): Promise<Hex> {
    return this.send("claimIssue", [issueId]);
  }
  async submitPr(issueId: bigint, deliverableHash: `0x${string}`, prNumber: number): Promise<Hex> {
    return this.send("submitPr", [issueId, deliverableHash, prNumber]);
  }
  async confirmMerge(issueId: bigint): Promise<Hex> {
    return this.send("confirmMerge", [issueId]);
  }
  async addCompliment(issueId: bigint, points: bigint): Promise<Hex> {
    return this.send("addCompliment", [issueId, points]);
  }
  async closeIssue(issueId: bigint): Promise<Hex> {
    return this.send("closeIssue", [issueId]);
  }
}

export function createOssWaveClient(cfg: OssWaveClientConfig): OssWaveClient {
  return new OssWaveClient(cfg);
}
