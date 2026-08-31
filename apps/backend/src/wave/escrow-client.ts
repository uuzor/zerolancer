import { Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import { WAVE_FUNDING_ESCROW_ABI } from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface WaveEscrowClientConfig {
  escrowAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// Funds-only vault client for WaveFundingEscrow. Holds a single shared ERC-20;
/// only the WaveFundingVerifier is authorized to call `claim`.
export class WaveEscrowClient {
  readonly escrow: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly escrowAddress: `0x${string}`;

  constructor(private readonly cfg: WaveEscrowClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.escrowAddress = cfg.escrowAddress;
    this.escrow = new TypedContract(
      cfg.escrowAddress,
      [...WAVE_FUNDING_ESCROW_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("wave escrow write requires a signer");
    return this.signer;
  }

  private async read<T>(method: string, args: unknown[]): Promise<T> {
    const fn = (this.escrow.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T;
  }

  private async send(method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (this.escrow.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    await tx.wait();
    return tx as unknown as Hex;
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  async pooledOf(programId: bigint): Promise<bigint> {
    return this.read("pooled", [programId]);
  }
  async distributedOf(programId: bigint): Promise<bigint> {
    return this.read("distributed", [programId]);
  }
  async waveBudgetOf(programId: bigint, waveId: bigint): Promise<bigint> {
    return this.read("waveBudgetOf", [programId, waveId]);
  }
  async programToken(programId: bigint): Promise<`0x${string}`> {
    return this.read("programToken", [programId]);
  }
  async verifier(): Promise<`0x${string}`> {
    return this.read("verifier", []);
  }
  async treasury(): Promise<`0x${string}`> {
    return this.read("treasury", []);
  }

  // ── Writes (signer-gated) ───────────────────────────────────────────────
  async deposit(programId: bigint, token: `0x${string}`, amount: bigint): Promise<Hex> {
    return this.send("deposit", [programId, token, amount]);
  }

  async claim(programId: bigint, waveId: bigint, who: `0x${string}`, amount: bigint): Promise<Hex> {
    return this.send("claim", [programId, waveId, who, amount]);
  }

  async setWaveBudget(programId: bigint, waveId: bigint, budget: bigint): Promise<Hex> {
    return this.send("setWaveBudget", [programId, waveId, budget]);
  }

  async emergencyWithdraw(programId: bigint, to: `0x${string}`, amount: bigint): Promise<Hex> {
    return this.send("emergencyWithdraw", [programId, amount, to]);
  }
}

export function createWaveEscrowClient(cfg: WaveEscrowClientConfig): WaveEscrowClient {
  return new WaveEscrowClient(cfg);
}
