import { Contract, Wallet, type JsonRpcProvider, Interface } from "ethers";
import type { Hex } from "viem";
import {
  ERC20_ABI,
  ZEROLANCE_WAVE_PROGRAM_ABI,
} from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";
import { waveStore } from "./store.js";

export interface WaveClientConfig {
  waveProgramAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

export class WaveClient {
  readonly program: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly programAddress: `0x${string}`;

  constructor(private readonly cfg: WaveClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.programAddress = cfg.waveProgramAddress;
    this.program = new TypedContract(
      cfg.waveProgramAddress,
      [...ZEROLANCE_WAVE_PROGRAM_ABI],
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

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("wave write requires a signer");
    return this.signer;
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
}

export function createWaveClient(cfg: WaveClientConfig): WaveClient {
  return new WaveClient(cfg);
}

export { waveStore };
