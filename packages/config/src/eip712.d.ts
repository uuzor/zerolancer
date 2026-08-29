import { SigningKey } from "ethers";
import type { Hex } from "viem";
export declare const EIP712_DOMAIN_NAME: "ZeroLanceTeeVerifier";
export declare const EIP712_DOMAIN_VERSION: "1";
export interface Eip712Domain {
    chainId: bigint;
    verifyingContract: `0x${string}`;
}
export declare const DEFAULT_EIP712_DOMAIN: Eip712Domain;
export declare function buildEip712Domain(chainId: number, verifyingContract: `0x${string}`): Eip712Domain;
export declare const VERDICT_TYPES: {
    readonly Verdict: readonly [{
        readonly name: "taskId";
        readonly type: "uint256";
    }, {
        readonly name: "deliverableHash";
        readonly type: "bytes32";
    }, {
        readonly name: "passed";
        readonly type: "bool";
    }, {
        readonly name: "score";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "bytes32";
    }, {
        readonly name: "validUntil";
        readonly type: "uint256";
    }];
};
export declare const OWNERSHIP_PROOF_TYPES: {
    readonly OwnershipProof: readonly [{
        readonly name: "dataHash";
        readonly type: "bytes32";
    }, {
        readonly name: "sealedKey";
        readonly type: "bytes";
    }, {
        readonly name: "targetPubkey";
        readonly type: "bytes";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "nft";
        readonly type: "address";
    }, {
        readonly name: "nonce";
        readonly type: "bytes";
    }, {
        readonly name: "validUntil";
        readonly type: "uint256";
    }];
};
export declare const ACCESS_PROOF_TYPES: {
    readonly AccessProof: readonly [{
        readonly name: "dataHash";
        readonly type: "bytes32";
    }, {
        readonly name: "targetPubkey";
        readonly type: "bytes";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "nft";
        readonly type: "address";
    }, {
        readonly name: "nonce";
        readonly type: "bytes";
    }, {
        readonly name: "validUntil";
        readonly type: "uint256";
    }];
};
export declare function domainSeparator(domain?: Eip712Domain): Hex;
export interface VerdictProofInput {
    taskId: Hex | bigint;
    deliverableHash: Hex;
    passed: boolean;
    score: bigint;
    nonce: Hex;
    validUntil: bigint;
}
export declare function verdictStructHash(input: VerdictProofInput): Hex;
export declare function verdictMessageHash(input: VerdictProofInput, domain?: Eip712Domain): Hex;
export declare function recoverVerdictSigner(signature: Hex, input: VerdictProofInput, domain?: Eip712Domain): Hex;
export interface OwnershipProofInput {
    dataHash: Hex;
    sealedKey: Hex;
    targetPubkey: Hex;
    to: Hex;
    nft: Hex;
    nonce: Hex;
    validUntil: bigint;
}
export interface AccessProofInput {
    dataHash: Hex;
    targetPubkey: Hex;
    to: Hex;
    nft: Hex;
    nonce: Hex;
    validUntil: bigint;
}
export declare function ownershipProofStructHash(input: OwnershipProofInput): Hex;
export declare function ownershipProofMessageHash(input: OwnershipProofInput, domain?: Eip712Domain): Hex;
export declare function accessProofStructHash(input: AccessProofInput): Hex;
export declare function accessProofMessageHash(input: AccessProofInput, domain?: Eip712Domain): Hex;
export declare function signOwnershipProof(signer: SigningKey, input: OwnershipProofInput, domain?: Eip712Domain): Hex;
export declare function signAccessProof(signer: SigningKey, input: AccessProofInput, domain?: Eip712Domain): Hex;
//# sourceMappingURL=eip712.d.ts.map