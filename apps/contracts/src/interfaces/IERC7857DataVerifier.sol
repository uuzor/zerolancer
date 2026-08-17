// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IERC7857DataVerifier
/// @notice Interface for the verifier contract that validates TransferValidityProofs.
/// @dev Re-implemented from EIP-7857 (https://eips.ethereum.org/EIPS/eip-7857) and
///      the 0G Agentic ID reference (MIT). This is the interface the NFT contract
///      calls during iTransfer / iTransferFrom.

/// @notice The type of oracle that signed the OwnershipProof.
enum OracleType {
    TEE,
    ZKP
}

/// @notice Signed by the receiver (or their access assistant) via EIP-712 typed data.
/// @dev Digest: keccak256(abi.encodePacked("\x19\x01", domainSeparator,
///      keccak256(abi.encode(ACCESS_PROOF_TYPEHASH, dataHash, keccak256(targetPubkey),
///      to, nft, keccak256(nonce), validUntil))))
struct AccessProof {
    bytes32 dataHash;
    bytes targetPubkey; // 64-byte raw uncompressed X||Y (no 0x04 prefix)
    bytes nonce;
    bytes proof; // raw ECDSA signature over the EIP-712 digest
    uint256 validUntil;
}

/// @notice Signed by the TEE/ZKP oracle via EIP-712 typed data.
/// @dev Digest: keccak256(abi.encodePacked("\x19\x01", domainSeparator,
///      keccak256(abi.encode(OWNERSHIP_PROOF_TYPEHASH, dataHash, keccak256(sealedKey),
///      keccak256(targetPubkey), to, nft, keccak256(nonce), validUntil))))
struct OwnershipProof {
    OracleType oracleType;
    bytes32 dataHash;
    bytes sealedKey; // Encryption key sealed for receiver (ECIES)
    bytes targetPubkey; // 64-byte raw uncompressed X||Y
    bytes nonce;
    bytes proof; // raw ECDSA signature over the EIP-712 digest
    uint256 validUntil;
}

/// @notice A pair of proofs required to transfer a token.
struct TransferValidityProof {
    AccessProof accessProof; // Signed by receiver (or access assistant)
    OwnershipProof ownershipProof; // Signed by TEE/ZKP oracle
}

/// @notice Output of verifyTransferValidity, consumed by the NFT contract.
struct TransferValidityProofOutput {
    bytes32 dataHash;
    bytes sealedKey;
    bytes targetPubkey;
    bytes wantedKey; // empty if receiver has no preference
    address accessAssistant; // recovered from AccessProof.signature
    bytes accessProofNonce;
    bytes ownershipProofNonce;
}

interface IERC7857DataVerifier {
    /// @notice Verify a batch of transfer validity proofs.
    /// @param _proofs Array of proofs (one per data item in the token).
    /// @param _to The intended recipient address.
    /// @param _nft The NFT contract address.
    /// @return outputs Array of proof outputs (one per proof).
    function verifyTransferValidity(
        TransferValidityProof[] calldata _proofs,
        address _to,
        address _nft
    ) external returns (TransferValidityProofOutput[] memory outputs);
}
