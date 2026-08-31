import { Wallet, type JsonRpcProvider } from "ethers";
import type { Hex } from "viem";
import {
  ERC20_ABI,
  ZEROLANCE_TASK_ESCROW_ABI,
  ZEROLANCE_TASK_REGISTRY_ABI,
  ZEROLANCE_TASK_VERIFIER_ABI,
  type Verdict,
} from "@zerolance/config";
import { TypedContract } from "@zerolance/config/types/contract";

export interface EscrowClientConfig {
  escrowAddress: `0x${string}`;
  taskRegistryAddress: `0x${string}`;
  paymentTokenAddress: `0x${string}`;
  provider: JsonRpcProvider;
  signer?: Wallet;
  verifierAddress?: `0x${string}`;
}

/// Server-side escrow client (post-rewrite). The escrow contract holds funds
/// only — the verifier (ZeroLanceTaskVerifier) owns verdict/dispute/reputation.
export class EscrowClient {
  readonly escrow: TypedContract<unknown>;
  readonly taskRegistry: TypedContract<unknown>;
  readonly paymentToken: TypedContract<unknown>;
  readonly verifier: TypedContract<unknown> | null;
  readonly signer: Wallet | undefined;

  constructor(private readonly cfg: EscrowClientConfig) {
    const runner = cfg.signer ?? cfg.provider;
    this.escrow = new TypedContract(
      cfg.escrowAddress,
      [...ZEROLANCE_TASK_ESCROW_ABI],
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
    this.verifier = cfg.verifierAddress
      ? new TypedContract(cfg.verifierAddress, [...ZEROLANCE_TASK_VERIFIER_ABI], runner)
      : null;
    this.signer = cfg.signer;
  }

  async escrowedOf(taskId: bigint): Promise<bigint> {
    return (await (this.escrow.contract as { escrowedOf: (id: bigint) => Promise<bigint> }).escrowedOf(taskId));
  }

  async releasedOf(taskId: bigint): Promise<boolean> {
    return (await (this.escrow.contract as { releasedOf: (id: bigint) => Promise<boolean> }).releasedOf(taskId));
  }

  async nextTaskId(): Promise<bigint> {
    return (await (this.taskRegistry.contract as { nextTaskId: () => Promise<bigint> }).nextTaskId());
  }

  /// Submit a signed AI verdict to the verifier (relay). The verifier checks
  /// the EIP-712 signature via teeVerifier and dispatches release/dispute.
  async submitVerdict(verdict: Verdict): Promise<Hex> {
    if (!this.signer) throw new Error("submitVerdict requires a signer");
    if (!this.verifier) throw new Error("submitVerdict requires a verifier contract address");
    const args = [
      verdict.taskId,
      verdict.deliverableHash,
      verdict.passed,
      verdict.score,
      verdict.nonce,
      verdict.validUntil,
      verdict.signature,
    ];
    const tx = await (this.verifier.contract as {
      submitVerdict: (v: unknown[]) => Promise<{ wait: () => Promise<unknown> }>;
    }).submitVerdict(args);
    await tx.wait();
    return tx as unknown as Hex;
  }
}