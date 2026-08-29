import { Contract, Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import {
  ERC20_ABI,
  ZEROLANCE_POINTS_LEDGER_ABI,
  ZEROLANCE_WAVE_PROGRAM_ABI,
  ZEROLANCE_WAVE_ISSUE_ABI,
  ZEROLANCE_WAVE_BUILDATHON_ABI,
} from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface WaveClientConfig {
  waveProgramAddress: `0x${string}`;
  waveIssueAddress: `0x${string}`;
  waveBuildathonAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// Server-side client for the Wave funding stack (WaveProgram + Wave Issue +
/// Wave Buildathon). Read-only by default; privileged writes require a signer.
export class WaveClient {
  readonly program: TypedContract<unknown>;
  readonly issue: TypedContract<unknown>;
  readonly buildathon: TypedContract<unknown>;
  readonly points: TypedContract<unknown>;
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
    this.points = new TypedContract(
      cfg.waveProgramAddress,
      [...ZEROLANCE_POINTS_LEDGER_ABI],
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

  private async ledgerFor(programId: bigint): Promise<TypedContract<unknown>> {
    const addr = await this.read<`0x${string}`>(this.program, "pointsLedger", [programId]);
    return new TypedContract(
      addr,
      [...ZEROLANCE_POINTS_LEDGER_ABI],
      this.signer ?? this.cfg.provider,
    );
  }

  // ── WaveProgram reads ────────────────────────────────────────────────────
  async programOf(programId: bigint): Promise<unknown> {
    return this.read(this.program, "program", [programId]);
  }
  async waveOf(programId: bigint, waveId: bigint): Promise<unknown> {
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
  async approved(programId: bigint, repoHash: `0x${string}`): Promise<boolean> {
    return this.read(this.program, "approved", [programId, repoHash]);
  }
  async totalPoints(programId: bigint, waveId: bigint): Promise<bigint> {
    const ledger = await this.ledgerFor(programId);
    return this.read(ledger, "totalPoints", [waveId]);
  }
  async contributorPoints(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<bigint> {
    const ledger = await this.ledgerFor(programId);
    return this.read(ledger, "contributorPoints", [waveId, who]);
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
    const tx = (await fn(...args)) as { wait: () => Promise<unknown> };
    await tx.wait();
    return tx as unknown as Hex;
  }

  // ── Write: program lifecycle ─────────────────────────────────────────────
  async depositPool(programId: bigint, amount: bigint): Promise<Hex> {
    return this.send(this.program, "depositPool", [programId, amount]);
  }
  async openWave(programId: bigint): Promise<Hex> {
    return this.send(this.program, "openWave", [programId]);
  }
  async closeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "closeWave", [programId, waveId]);
  }
  async openEvaluation(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "openEvaluation", [programId, waveId]);
  }
  async closeEvaluation(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "closeEvaluation", [programId, waveId]);
  }
  async finalizeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "finalizeWave", [programId, waveId]);
  }
  async claim(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send(this.program, "claim", [programId, waveId]);
  }
  async createWaveProgram(
    token: `0x${string}`,
    genesisPool: bigint,
    numWaves: bigint,
    buildWindow: bigint,
    evalWindow: bigint,
    complimentWindow: bigint,
    budgetMethod: number,
    feeBps: number,
    treasury: `0x${string}`,
    specHash: `0x${string}`,
  ): Promise<Hex> {
    return this.send(this.program, "createWaveProgram", [
      token,
      genesisPool,
      numWaves,
      buildWindow,
      evalWindow,
      complimentWindow,
      budgetMethod,
      feeBps,
      treasury,
      specHash,
    ]);
  }
  async grantAwarder(programId: bigint, awarder: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send(this.program, "grantAwarder", [programId, awarder, allowed]);
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