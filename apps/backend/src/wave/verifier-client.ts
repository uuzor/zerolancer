import { Wallet, type JsonRpcProvider, Interface } from "ethers";
import type { Hex } from "viem";
import { WAVE_FUNDING_VERIFIER_ABI } from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";
import { waveStore } from "./store.js";

export interface WaveVerifierClientConfig {
  verifierAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// State-and-rules client for WaveFundingVerifier. Owns programs, waves,
/// projects, awarders, points. Calls escrow for budget locks and claims.
export class WaveVerifierClient {
  readonly verifier: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly verifierAddress: `0x${string}`;

  constructor(private readonly cfg: WaveVerifierClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.verifierAddress = cfg.verifierAddress;
    this.verifier = new TypedContract(
      cfg.verifierAddress,
      [...WAVE_FUNDING_VERIFIER_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("wave verifier write requires a signer");
    return this.signer;
  }

  private async read<T>(method: string, args: unknown[]): Promise<T> {
    const fn = (this.verifier.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T;
  }

  private async send(method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (this.verifier.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    await tx.wait();
    return tx as unknown as Hex;
  }

  private async sendWithReceipt(method: string, args: unknown[]): Promise<{ txHash: Hex; programId: bigint }> {
    this.requireSigner();
    const fn = (this.verifier.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    const receipt = await tx.wait();
    const iface = new Interface([...WAVE_FUNDING_VERIFIER_ABI]);
    let programId = BigInt(0);
    if (receipt && typeof receipt === "object" && "logs" in receipt) {
      const logs = (receipt as { logs: { topics: ReadonlyArray<string>; data: string }[] }).logs;
      for (const log of logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === "ProgramCreated") {
            programId = BigInt(parsed.args.programId.toString());
            break;
          }
        } catch {}
      }
    }
    return { txHash: tx as unknown as Hex, programId };
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  async programOf(programId: bigint): Promise<unknown> {
    return this.read("program", [programId]);
  }
  async waveOf(waveId: bigint): Promise<unknown> {
    return this.read("wave", [waveId]);
  }
  async projectOf(projectId: bigint): Promise<unknown> {
    return this.read("project", [projectId]);
  }
  async waveProjects(programId: bigint, waveId: bigint): Promise<bigint[]> {
    return this.read("waveProjects", [programId, waveId]);
  }
  async waveCount(programId: bigint): Promise<bigint> {
    return this.read("waveCount", [programId]);
  }
  async remainingPool(programId: bigint): Promise<bigint> {
    return this.read("remainingPool", [programId]);
  }
  async waveBudget(programId: bigint, waveId: bigint): Promise<bigint> {
    return this.read("waveBudget", [programId, waveId]);
  }
  async totalClaimable(programId: bigint, waveId: bigint): Promise<bigint> {
    return this.read("totalClaimable", [programId, waveId]);
  }
  async claimableShare(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<bigint> {
    return this.read("claimableShare", [programId, waveId, who]);
  }
  async claimed(programId: bigint, waveId: bigint, who: `0x${string}`): Promise<boolean> {
    return this.read("claimed", [programId, waveId, who]);
  }
  async currentOpenWave(programId: bigint): Promise<bigint> {
    return this.read("currentOpenWave", [programId]);
  }

  // ── Writes (signer-gated) ───────────────────────────────────────────────
  async createWaveProgram(args: {
    token: `0x${string}`;
    genesisPool: bigint;
    numWaves: number;
    buildWindow: number;
    evalWindow: number;
    complimentWindow: number;
    budgetMethod: number;
    feeBps: number;
    treasury: `0x${string}`;
    specHash: `0x${string}`;
  }): Promise<{ txHash: Hex; programId: bigint }> {
    const { txHash, programId } = await this.sendWithReceipt("createWaveProgram", [
      args.token,
      args.genesisPool,
      args.numWaves,
      args.buildWindow,
      args.evalWindow,
      args.complimentWindow,
      args.budgetMethod,
      args.feeBps,
      args.treasury,
      args.specHash,
    ]);
    waveStore.upsertProgram({
      programId: programId.toString(),
      organizer: "",
      token: args.token,
      genesisPool: args.genesisPool.toString(),
      numWaves: String(args.numWaves),
      buildWindow: String(args.buildWindow),
      evalWindow: String(args.evalWindow),
      complimentWindow: String(args.complimentWindow),
      budgetMethod: String(args.budgetMethod),
      feeBps: String(args.feeBps),
      treasury: args.treasury,
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { txHash, programId };
  }

  async depositPool(programId: bigint, amount: bigint): Promise<Hex> {
    return this.send("depositPool", [programId, amount]);
  }
  async openWave(programId: bigint): Promise<Hex> {
    return this.send("openWave", [programId]);
  }
  async closeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("closeWave", [programId, waveId]);
  }
  async closeEvaluation(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("closeEvaluation", [programId, waveId]);
  }
  async finalizeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("finalizeWave", [programId, waveId]);
  }
  async closeProgram(programId: bigint): Promise<Hex> {
    return this.send("closeProgram", [programId]);
  }
  async grantAwarder(programId: bigint, who: `0x${string}`, allowed: boolean): Promise<Hex> {
    return this.send("grantAwarder", [programId, who, allowed]);
  }
  async registerProject(args: {
    programId: bigint;
    waveId: bigint;
    wallet: `0x${string}`;
    repoUrl: string;
  }): Promise<Hex> {
    return this.send("registerProject", [args.programId, args.waveId, args.wallet, args.repoUrl]);
  }
  async setProjectPoints(programId: bigint, projectId: bigint, points: bigint): Promise<Hex> {
    return this.send("setProjectPoints", [programId, projectId, points]);
  }
  async awardBase(waveId: bigint, contributor: `0x${string}`, points: bigint, refHash: `0x${string}`): Promise<Hex> {
    return this.send("awardBase", [waveId, contributor, points, refHash]);
  }
  async awardCompliment(waveId: bigint, contributor: `0x${string}`, points: bigint, refHash: `0x${string}`): Promise<Hex> {
    return this.send("awardCompliment", [waveId, contributor, points, refHash]);
  }
  async awardCommunity(waveId: bigint, contributor: `0x${string}`, points: bigint, refHash: `0x${string}`): Promise<Hex> {
    return this.send("awardCommunity", [waveId, contributor, points, refHash]);
  }
  async claim(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("claim", [programId, waveId]);
  }
}

export function createWaveVerifierClient(cfg: WaveVerifierClientConfig): WaveVerifierClient {
  return new WaveVerifierClient(cfg);
}
