import { Contract, Wallet, type JsonRpcProvider, Interface } from "ethers";
import type { Hex } from "viem";
import {
  ERC20_ABI,
  ZEROLANCE_POINTS_LEDGER_ABI,
  ZEROLANCE_WAVE_PROGRAM_ABI,
  ZEROLANCE_WAVE_ISSUE_ABI,
  ZEROLANCE_WAVE_BUILDATHON_ABI,
} from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";
import { waveStore } from "./store.js";

export interface WaveClientConfig {
  waveProgramAddress: `0x${string}`;
  waveIssueAddress: `0x${string}`;
  waveBuildathonAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

export class WaveClient {
  readonly program: TypedContract<unknown>;
  readonly issue: TypedContract<unknown>;
  readonly buildathon: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly programAddress: `0x${string}`;
  readonly issueAddress: `0x${string}`;
  readonly buildathonAddress: `0x${string}`;

  constructor(private readonly cfg: WaveClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.programAddress = cfg.waveProgramAddress;
    this.issueAddress = cfg.waveIssueAddress;
    this.buildathonAddress = cfg.waveBuildathonAddress;
    this.program = new TypedContract(
      cfg.waveProgramAddress,
      [...ZEROLANCE_WAVE_PROGRAM_ABI],
      runner,
    );
    this.issue = new TypedContract(
      cfg.waveIssueAddress,
      [...ZEROLANCE_WAVE_ISSUE_ABI],
      runner,
    );
    this.buildathon = new TypedContract(
      cfg.waveBuildathonAddress,
      [...ZEROLANCE_WAVE_BUILDATHON_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private async read<T>(
    contract: TypedContract<unknown>,
    method: string,
    args: unknown[],
  ): Promise<T> {
    const fn = (contract.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[
      method
    ] as ((...a: unknown[]) => Promise<T>) | ((...a: unknown[]) => T);
    return (await fn!(...args)) as T;
  }

  // ── WaveProgram reads ────────────────────────────────────────────────────
  async programOf(programId: bigint): Promise<unknown> {
    return this.read(this.program, "program", [programId]);
  }
  async waveOf(waveId: bigint): Promise<unknown> {
    return this.read(this.program, "wave", [waveId]);
  }
  async remainingPool(programId: bigint): Promise<bigint> {
    return this.read(this.program, "remainingPool", [programId]);
  }
  async waveBudget(programId: bigint, waveId: bigint): Promise<bigint> {
    return this.read(this.program, "waveBudget", [programId, waveId]);
  }
  async totalClaimable(programId: bigint, waveId: bigint): Promise<bigint> {
    return this.read(this.program, "totalClaimable", [programId, waveId]);
  }
  async claimableShare(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<bigint> {
    return this.read(this.program, "claimableShare", [programId, waveId, who]);
  }
  async claimed(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<boolean> {
    return this.read(this.program, "claimed", [programId, waveId, who]);
  }
  async projectOf(projectId: bigint): Promise<unknown> {
    return this.read(this.program, "project", [projectId]);
  }
  async waveProjects(programId: bigint, waveId: bigint): Promise<unknown> {
    return this.read(this.program, "waveProjects", [programId, waveId]);
  }

  // ── Wave Issue reads ─────────────────────────────────────────────────────
  async issueOf(issueId: bigint): Promise<unknown> {
    return this.read(this.issue, "issue", [issueId]);
  }

  // ── Wave Buildathon reads ────────────────────────────────────────────────
  async submissionOf(subId: bigint): Promise<unknown> {
    return this.read(this.buildathon, "submission", [subId]);
  }

  // ── Transaction helpers ──────────────────────────────────────────────────
  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("wave write requires a signer");
    return this.signer;
  }

  private async send(contract: TypedContract<unknown>, method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (contract.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = (await fn!(...args)) as { wait: () => Promise<any> };
    await tx.wait();
    return tx as unknown as Hex;
  }

  private async sendWithReceipt(contract: TypedContract<unknown>, method: string, args: unknown[]): Promise<{ txHash: Hex; receipt: any }> {
    this.requireSigner();
    const fn = (contract.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = (await fn!(...args)) as { wait: () => Promise<any> };
    const receipt = await tx.wait();
    return { txHash: tx as unknown as Hex, receipt };
  }

  // ── Write: program lifecycle ─────────────────────────────────────────────
  async createWaveProgram(
    token: `0x${string}`,
    genesisPool: bigint,
    feeBps: number,
    treasury: `0x${string}`,
  ): Promise<{ txHash: Hex; programId: bigint }> {
    const { txHash, receipt } = await this.sendWithReceipt(this.program, "createWaveProgram", [
      token,
      genesisPool,
      feeBps,
      treasury,
    ]);
    const iface = new Interface([...ZEROLANCE_WAVE_PROGRAM_ABI]);
    let programId = BigInt(0);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "ProgramCreated") {
          programId = parsed.args.programId;
          break;
        }
      } catch {}
    }
    return { txHash, programId };
  }

  async depositPool(programId: bigint, amount: bigint): Promise<Hex> {
    return this.send(this.program, "depositPool", [programId, amount]);
  }
  async openWave(programId: bigint): Promise<Hex> {
    return this.send(this.program, "openWave", [programId]);
  }
  async closeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "closeWave", [programId, waveId]);
  }
  async finalizeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "finalizeWave", [programId, waveId]);
  }
  async claim(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<Hex> {
    return this.send(this.program, "claim", [programId, waveId, who]);
  }

  // ── Write: projects ─────────────────────────────────────────────────────
  async registerProject(
    programId: bigint,
    waveId: bigint,
    builder: `0x${string}`,
    repoHash: `0x${string}`,
  ): Promise<Hex> {
    return this.send(this.program, "registerProject", [programId, waveId, builder, repoHash]);
  }

  async setProjectPoints(projectId: bigint, points: bigint): Promise<Hex> {
    return this.send(this.program, "setProjectPoints", [projectId, points]);
  }

  // ── Write: Wave Issue ────────────────────────────────────────────────────
  async acceptRepo(programId: bigint, repoHash: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send(this.issue, "acceptRepo", [programId, repoHash, allowed]);
  }
  async createIssue(
    programId: bigint,
    repoHash: `0x${string}`,
    specHash: `0x${string}`,
    basePoints: bigint,
    complexity: bigint,
  ): Promise<Hex> {
    return this.send(this.issue, "createIssue", [
      programId,
      repoHash,
      specHash,
      basePoints,
      complexity,
    ]);
  }
  async setIssuePoints(issueId: bigint, basePoints: bigint): Promise<Hex> {
    return this.send(this.issue, "setIssuePoints", [issueId, basePoints]);
  }
  async claimIssue(issueId: bigint): Promise<Hex> {
    return this.send(this.issue, "claimIssue", [issueId]);
  }
  async submitPr(issueId: bigint, deliverableHash: `0x${string}`, prNumber: bigint): Promise<Hex> {
    return this.send(this.issue, "submitPr", [issueId, deliverableHash, prNumber]);
  }
  async confirmMerge(issueId: bigint): Promise<Hex> {
    return this.send(this.issue, "confirmMerge", [issueId]);
  }
  async addCompliment(issueId: bigint, points: bigint): Promise<Hex> {
    return this.send(this.issue, "addCompliment", [issueId, points]);
  }

  // ── Write: Wave Buildathon ───────────────────────────────────────────────
  async registerTeam(programId: bigint, team: `0x${string}`, productRepoHash: `0x${string}`): Promise<Hex> {
    return this.send(this.buildathon, "registerTeam", [programId, team, productRepoHash]);
  }
  async submit(
    programId: bigint,
    teamId: bigint,
    contentHash: `0x${string}`,
    repoHash: `0x${string}`,
  ): Promise<Hex> {
    return this.send(this.buildathon, "submit", [programId, teamId, contentHash, repoHash]);
  }
  async setJudge(programId: bigint, judge: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send(this.buildathon, "setJudge", [programId, judge, allowed]);
  }
  async setSubmissionPoints(programId: bigint, subId: bigint, points: bigint): Promise<Hex> {
    return this.send(this.buildathon, "setSubmissionPoints", [programId, subId, points]);
  }
  async castVote(programId: bigint, subId: bigint, weight: bigint): Promise<Hex> {
    return this.send(this.buildathon, "castVote", [programId, subId, weight]);
  }
}

export function createWaveClient(cfg: WaveClientConfig): WaveClient {
  return new WaveClient(cfg);
}

export { waveStore };
