import { toUtf8Bytes, keccak256, AbiCoder, concat, getBytes, SigningKey, computeAddress, } from "ethers";
/// EIP-712 domain for ZeroLanceTeeVerifier. MUST match the on-chain constants
/// in `ZeroLanceTeeVerifier.sol` (name="ZeroLanceTeeVerifier", version="1").
export const EIP712_DOMAIN_NAME = "ZeroLanceTeeVerifier";
export const EIP712_DOMAIN_VERSION = "1";
/// Placeholder until the verifier proxy address is known at deploy time.
/// The oracle resolves the real domain from ZERO_TEE_VERIFIER_ADDRESS.
export const DEFAULT_EIP712_DOMAIN = {
    chainId: 16661n,
    verifyingContract: "0x0000000000000000000000000000000000000000",
};
export function buildEip712Domain(chainId, verifyingContract) {
    return {
        chainId: BigInt(chainId),
        verifyingContract,
    };
}
export const VERDICT_TYPES = {
    Verdict: [
        { name: "taskId", type: "uint256" },
        { name: "deliverableHash", type: "bytes32" },
        { name: "passed", type: "bool" },
        { name: "score", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "validUntil", type: "uint256" },
    ],
};
export const OWNERSHIP_PROOF_TYPES = {
    OwnershipProof: [
        { name: "dataHash", type: "bytes32" },
        { name: "sealedKey", type: "bytes" },
        { name: "targetPubkey", type: "bytes" },
        { name: "to", type: "address" },
        { name: "nft", type: "address" },
        { name: "nonce", type: "bytes" },
        { name: "validUntil", type: "uint256" },
    ],
};
export const ACCESS_PROOF_TYPES = {
    AccessProof: [
        { name: "dataHash", type: "bytes32" },
        { name: "targetPubkey", type: "bytes" },
        { name: "to", type: "address" },
        { name: "nft", type: "address" },
        { name: "nonce", type: "bytes" },
        { name: "validUntil", type: "uint256" },
    ],
};
const EIP712_DOMAIN_TYPEHASH = keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
const VERDICT_TYPEHASH = keccak256(toUtf8Bytes("Verdict(uint256 taskId,bytes32 deliverableHash,bool passed,uint256 score,bytes32 nonce,uint256 validUntil)"));
const VERIFIER_NAME_HASH = keccak256(toUtf8Bytes(EIP712_DOMAIN_NAME));
const VERIFIER_VERSION_HASH = keccak256(toUtf8Bytes(EIP712_DOMAIN_VERSION));
const abiCoder = AbiCoder.defaultAbiCoder();
export function domainSeparator(domain) {
    const activeDomain = domain ?? DEFAULT_EIP712_DOMAIN;
    return keccak256(abiCoder.encode(["bytes32", "bytes32", "bytes32", "uint256", "address"], [
        EIP712_DOMAIN_TYPEHASH,
        VERIFIER_NAME_HASH,
        VERIFIER_VERSION_HASH,
        activeDomain.chainId,
        activeDomain.verifyingContract,
    ]));
}
export function verdictStructHash(input) {
    const taskId = typeof input.taskId === "bigint" ? input.taskId : BigInt(input.taskId);
    return keccak256(abiCoder.encode(["bytes32", "uint256", "bytes32", "bool", "uint256", "bytes32", "uint256"], [
        VERDICT_TYPEHASH,
        taskId,
        input.deliverableHash,
        input.passed,
        input.score,
        input.nonce,
        input.validUntil,
    ]));
}
export function verdictMessageHash(input, domain) {
    return keccak256(concat(["0x1901", domainSeparator(domain), verdictStructHash(input)]));
}
export function recoverVerdictSigner(signature, input, domain) {
    const recovered = SigningKey.recoverPublicKey(getBytes(verdictMessageHash(input, domain)), signature);
    return computeAddress(recovered);
}
// ── ERC-7857 transfer-validity proofs (OwnershipProof / AccessProof) ──────────
const OWNERSHIP_PROOF_TYPEHASH = keccak256(toUtf8Bytes("OwnershipProof(bytes32 dataHash,bytes sealedKey,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"));
const ACCESS_PROOF_TYPEHASH = keccak256(toUtf8Bytes("AccessProof(bytes32 dataHash,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"));
export function ownershipProofStructHash(input) {
    return keccak256(abiCoder.encode(["bytes32", "bytes32", "bytes32", "bytes32", "address", "address", "bytes32", "uint256"], [
        OWNERSHIP_PROOF_TYPEHASH,
        input.dataHash,
        keccak256(input.sealedKey),
        keccak256(input.targetPubkey),
        input.to,
        input.nft,
        keccak256(input.nonce),
        input.validUntil,
    ]));
}
export function ownershipProofMessageHash(input, domain) {
    return keccak256(concat(["0x1901", domainSeparator(domain), ownershipProofStructHash(input)]));
}
export function accessProofStructHash(input) {
    return keccak256(abiCoder.encode(["bytes32", "bytes32", "bytes32", "address", "address", "bytes32", "uint256"], [
        ACCESS_PROOF_TYPEHASH,
        input.dataHash,
        keccak256(input.targetPubkey),
        input.to,
        input.nft,
        keccak256(input.nonce),
        input.validUntil,
    ]));
}
export function accessProofMessageHash(input, domain) {
    return keccak256(concat(["0x1901", domainSeparator(domain), accessProofStructHash(input)]));
}
export function signOwnershipProof(signer, input, domain) {
    return signer.sign(getBytes(ownershipProofMessageHash(input, domain))).serialized;
}
export function signAccessProof(signer, input, domain) {
    return signer.sign(getBytes(accessProofMessageHash(input, domain))).serialized;
}
//# sourceMappingURL=eip712.js.map