import { Wallet, type JsonRpcProvider, Interface } from "ethers";
import type { Hex } from "viem";
import { WAVE_FUNDING_VAULT_ABI } from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface WaveFundingVaultClientConfig {
  vaultAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// Unified wave operations client for WaveFundingVault. Replaces the old
/// WaveEscrowClient + WaveVerifierClient + OssWaveClient + BuildathonWaveClient.
/// Owns programs, waves, points, claims, and dispute resolution.
export class WaveFundingVaultClient {
  readonly vault: TypedContract<unknown>;
  readonly signer: Wallet | undefined;
  readonly vaultAddress: `0x${string}`;

  constructor(private readonly cfg: WaveFundingVaultClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.vaultAddress = cfg.vaultAddress;
    this.vault = new TypedContract(
      cfg.vaultAddress,
      [...WAVE_FUNDING_VAULT_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  private requireSigner(): Wallet {
    if (!this.signer) throw new Error("wave vault write requires a signer");
    return this.signer;
  }

  private async read<T>(method: string, args: unknown[]): Promise<T> {
    const fn = (this.vault.raw as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T;
  }

  private async send(method: string, args: unknown[]): Promise<Hex> {
    this.requireSigner();
    const fn = (this.vault.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    await tx.wait();
    return tx as unknown as Hex;
  }

  private async sendWithReceipt(method: string, args: unknown[]): Promise<{ txHash: Hex; programId: bigint }> {
    this.requireSigner();
    const fn = (this.vault.raw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
    const tx = await (fn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(...args);
    const receipt = await tx.wait();
    const iface = new Interface([...WAVE_FUNDING_VAULT_ABI]);
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
    return this.read("programOf", [programId]);
  }
  async waveOf(waveId: bigint): Promise<unknown> {
    return this.read("waveOf", [waveId]);
  }
  async waveCount(programId: bigint): Promise<bigint> {
    return this.read("waveCount", [programId]);
  }
  async builderPoints(waveId: bigint, builder: `0x${string}`): Promise<bigint> {
    return this.read("builderPoints", [waveId, builder]);
  }
  async totalWavePoints(waveId: bigint): Promise<bigint> {
    return this.read("totalWavePoints", [waveId]);
  }
  async claimableShare(waveId: bigint, builder: `0x${string}`): Promise<bigint> {
    return this.read("claimableShare", [waveId, builder]);
  }
  async pooled(programId: bigint): Promise<bigint> {
    return this.read("pooled", [programId]);
  }
  async distributed(programId: bigint): Promise<bigint> {
    return this.read("distributed", [programId]);
  }
  async treasury(): Promise<`0x${string}`> {
    return this.read("treasury", []);
  }

  // ── Writes (signer-gated) ───────────────────────────────────────────────
  async createProgram(args: {
    token: `0x${string}`;
    genesisPool: bigint;
    numWaves: bigint;
    feeBps: number;
    treasury: `0x${string}`;
    specHash: `0x${string}`;
  }): Promise<{ txHash: Hex; programId: bigint }> {
    return this.sendWithReceipt("createProgram", [
      args.token,
      args.genesisPool,
      args.numWaves,
      args.feeBps,
      args.treasury,
      args.specHash,
    ]);
  }

  async deposit(programId: bigint, amount: bigint): Promise<Hex> {
    return this.send("deposit", [programId, amount]);
  }

  async openWave(programId: bigint): Promise<Hex> {
    return this.send("openWave", [programId]);
  }

  async closeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("closeWave", [programId, waveId]);
  }

  async finalizeWave(programId: bigint, waveId: bigint): Promise<Hex> {
    return this.send("finalizeWave", [programId, waveId]);
  }

  async setPoints(waveId: bigint, builder: `0x${string}`, points: bigint): Promise<Hex> {
    return this.send("setPoints", [waveId, builder, points]);
  }

  async claim(waveId: bigint, builder: `0x${string}`): Promise<Hex> {
    return this.send("claim", [waveId, builder]);
  }

  async resolveDispute(taskId: bigint, winner: `0x${string}`): Promise<Hex> {
    return this.send("resolveDispute", [taskId, winner]);
  }

  async emergencyWithdraw(programId: bigint, to: `0x${string}`, amount: bigint): Promise<Hex> {
    return this.send("emergencyWithdraw", [programId, to, amount]);
  }
}

export function createWaveFundingVaultClient(cfg: WaveFundingVaultClientConfig): WaveFundingVaultClient {
  return new WaveFundingVaultClient(cfg);
}
