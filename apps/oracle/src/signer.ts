import { Wallet } from "ethers";
import type { Hex } from "viem";

import { publicKeyUncompressedFromPrivate } from "@zerolance/config/crypto/keys";
import {
  DEFAULT_EIP712_DOMAIN,
  verdictMessageHash as eip712VerdictMessageHash,
  recoverVerdictSigner as eip712RecoverVerdictSigner,
  ownershipProofMessageHash as eip712OwnershipProofMessageHash,
  accessProofMessageHash as eip712AccessProofMessageHash,
  signOwnershipProof as eip712SignOwnershipProof,
  signAccessProof as eip712SignAccessProof,
  type Eip712Domain,
  type VerdictProofInput,
  type OwnershipProofInput,
  type AccessProofInput,
} from "@zerolance/config/eip712";

export function verdictMessageHash(
  input: VerdictProofInput,
  domain: Eip712Domain = DEFAULT_EIP712_DOMAIN,
): Hex {
  return eip712VerdictMessageHash(input, domain);
}

/// The simulated-TEE signer. Holds a secp256k1 keypair and signs EIP-712
/// verdicts. In production this is replaced by an Intel TDX/AMD SEV TEE.
export class TeeSigner {
  readonly wallet: Wallet;
  readonly address: Hex;
  readonly uncompressedPubkey: Uint8Array;
  readonly privateKeyBytes: Uint8Array;
  readonly domain: Eip712Domain;

  constructor(
    privateKeyHex: string,
    domain: Eip712Domain = DEFAULT_EIP712_DOMAIN,
  ) {
    this.wallet = new Wallet(privateKeyHex);
    this.address = this.wallet.address as Hex;
    this.domain = domain;
    const priv = Uint8Array.from(
      Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex"),
    );
    this.privateKeyBytes = priv;
    this.uncompressedPubkey = publicKeyUncompressedFromPrivate(priv);
  }

  /// Sign an AI verdict (EIP-712). The resulting signature is submitted on-chain
  /// via ZeroLanceEscrowVault.submitVerdict and verified by ZeroLanceTeeVerifier.
  signVerdict(input: VerdictProofInput): Hex {
    const digest = verdictMessageHash(input, this.domain);
    return this.wallet.signingKey.sign(digest).serialized as Hex;
  }

  recoverVerdictSigner(signature: Hex, input: VerdictProofInput): Hex {
    return eip712RecoverVerdictSigner(signature, input, this.domain);
  }

  /// Sign an ERC-7857 OwnershipProof (EIP-712). The TEE signs after re-keying
  /// the encrypted metadata blob on 0G Storage — the proof attests that the
  /// sealedKey was produced for the receiver's targetPubkey.
  signOwnershipProof(input: OwnershipProofInput): Hex {
    return eip712SignOwnershipProof(this.wallet.signingKey, input, this.domain);
  }

  /// Compute the EIP-712 message hash for an OwnershipProof (for testing).
  ownershipProofMessageHash(input: OwnershipProofInput): Hex {
    return eip712OwnershipProofMessageHash(input, this.domain);
  }

  /// Compute the EIP-712 message hash for an AccessProof (for testing).
  accessProofMessageHash(input: AccessProofInput): Hex {
    return eip712AccessProofMessageHash(input, this.domain);
  }

  /// Sign an ERC-7857 AccessProof on behalf of a receiver (EIP-712).
  /// In production the receiver signs this in their browser wallet; this helper
  /// is for devnet/testing where the oracle also holds the receiver's key.
  signAccessProof(receiverWallet: Wallet, input: AccessProofInput): Hex {
    return eip712SignAccessProof(receiverWallet.signingKey, input, this.domain);
  }
}
