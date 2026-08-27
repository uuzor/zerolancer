import { Contract, Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import {
  ERC20_ABI,
  ZEROLANCE_ESCROW_VAULT_ABI,
  ZEROLANCE_TASK_REGISTRY_ABI,
  type Verdict,
} from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface EscrowClientConfig {
  escrowAddress: `0x${string}`;
  taskRegistryAddress: `0x${string}`;
  paymentTokenAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
}

/// Server-side escrow client. Read-only by default; privileged writes (submitVerdict,
/// resolveDispute, refund) require a signer.
export class EscrowClient {
  readonly escrow: TypedContract<unknown>;
  readonly taskRegistry: TypedContract<unknown>;
  readonly paymentToken: TypedContract<unknown>;
  readonly signer: Wallet | undefined;

  constructor(private readonly cfg: EscrowClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.escrow = new TypedContract(
      cfg.escrowAddress,
      [...ZEROLANCE_ESCROW_VAULT_ABI],
      runner,
    );
    this.taskRegistry = new TypedContract(
      cfg.taskRegistryAddress,
      [...ZEROLANCE_TASK_REGISTRY_ABI],
      runner,
    );
    this.paymentToken = new TypedContract(
      cfg.paymentTokenAddress,
      [...ERC20_ABI],
      runner,
    );
    this.signer = cfg.signer;
  }

  async escrowedOf(taskId: bigint): Promise<bigint> {
    return (await (this.escrow.contract as { escrowedOf: (id: bigint) => Promise<bigint> } | {
      escrowedOf: (id: bigint) => bigint;
    }).escrowedOf(taskId)) as unknown as bigint;
  }

  async releasedOf(taskId: bigint): Promise<boolean> {
    return (await (this.escrow.contract as { releasedOf: (id: bigint) => Promise<boolean> } | {
      releasedOf: (id: bigint) => boolean;
    }).releasedOf(taskId)) as unknown as boolean;
  }

  async nextTaskId(): Promise<bigint> {
    return (await (this.taskRegistry.contract as { nextTaskId: () => Promise<bigint> } | {
      nextTaskId: () => bigint;
    }).nextTaskId()) as unknown as bigint;
  }

  /// Submit a signed AI verdict to the vault (permissionless relay).
  /// Anyone may call submitVerdict; the on-chain verifier is the trust anchor.
  /// The ABI declares an unnamed tuple, so we pass a positional array to
  /// satisfy ethers v6 (named objects require named tuple components).
  async submitVerdict(verdict: Verdict): Promise<Hex> {
    if (!this.signer) throw new Error("submitVerdict requires a signer");
    const args = [
      verdict.taskId,
      verdict.deliverableHash,
      verdict.passed,
      verdict.score,
      verdict.nonce,
      verdict.validUntil,
      verdict.signature,
    ];
    const tx = await (this.escrow.contract as {
      submitVerdict: (v: unknown[]) => Promise<{
        hash: `0x${string}`;
        wait: () => Promise<unknown>;
      }>;
    }).submitVerdict(args);
    await tx.wait();
    return tx.hash;
  }
}
