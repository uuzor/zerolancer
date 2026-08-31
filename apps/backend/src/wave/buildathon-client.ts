import { Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import { ZEROLANCE_BUILDATHON_WAVE_ABI } from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface BuildathonWaveClientConfig {
  buildathonAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// Buildathon mode operations client. Teams register products, submit per-wave
/// demos/updates, earn judge + community points.
export class BuildathonWaveClient {
  readonly buildathon: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly buildathonAddress: `0x${string}`;

  constructor(private readonly cfg: BuildathonWaveClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.buildathonAddress = cfg.buildathonAddress;
    this.buildathon = new TypedContract(
      cfg.buildathonAddress,
      [...ZEROLANCE_BUILDATHON_WAVE_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("buildathon wave write requires a signer");
    return this.signer;
  }

  private async read<T>(method: string, args: unknown[]): Promise<T> {
    const fn = (this.buildathon.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T;
  }

  private async send(method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (this.buildathon.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    await tx.wait();
    return tx as unknown as Hex;
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  async team(teamId: bigint): Promise<unknown> {
    return this.read("team", [teamId]);
  }
  async submission(subId: bigint): Promise<unknown> {
    return this.read("submission", [subId]);
  }

  // ── Writes (signer-gated) ───────────────────────────────────────────────
  async registerTeam(programId: bigint, wallet: `0x${string}`, repoUrl: string): Promise<Hex> {
    return this.send("registerTeam", [programId, wallet, repoUrl]);
  }
  async submit(args: {
    programId: bigint;
    teamId: bigint;
    contentHash: `0x${string}`;
    repoHash: `0x${string}`;
  }): Promise<Hex> {
    return this.send("submit", [args.programId, args.teamId, args.contentHash, args.repoHash]);
  }
  async setSubmissionPoints(programId: bigint, subId: bigint, points: bigint): Promise<Hex> {
    return this.send("setSubmissionPoints", [programId, subId, points]);
  }
  async castVote(programId: bigint, subId: bigint, weight: bigint): Promise<Hex> {
    return this.send("castVote", [programId, subId, weight]);
  }
}

export function createBuildathonWaveClient(cfg: BuildathonWaveClientConfig): BuildathonWaveClient {
  return new BuildathonWaveClient(cfg);
}
