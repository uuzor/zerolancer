// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceTeeVerifier
/// @notice Interface for the TEE verifier that validates AI verdicts and
///         ERC-7857 transfer-validity proofs.
/// @dev Verdicts are signed off-chain by the registered TEE signer (the oracle)
///      using EIP-712 typed data. The escrow vault trusts a `passed` verdict to
///      auto-release funds.
interface IZeroLanceTeeVerifier {
    /// @notice A signed AI verification verdict for a task deliverable.
    /// @dev Signed by the oracle over the EIP-712 `Verdict` struct hash.
    struct Verdict {
        uint256 taskId; // the task being verified
        bytes32 deliverableHash; // must match the submitted deliverable hash
        bool passed; // true → release escrow; false → retry window
        uint256 score; // 0..10000 (bps) — coverage / similarity / compliance score
        bytes32 nonce; // replay protection
        uint256 validUntil; // unix-seconds deadline
        bytes signature; // raw ECDSA over the EIP-712 digest, by the registered signer
    }

    event SignerProposed(address indexed newSigner, uint256 executableAt);
    event SignerExecuted(address indexed oldSigner, address indexed newSigner);
    event SignerProposalCancelled(address indexed cancelledSigner);

    function registeredSigner() external view returns (address);
    function maxProofAgeSeconds() external view returns (uint256);
    function domainSeparator() external view returns (bytes32);

    /// @notice Verify an AI verdict signature and mark its nonce used (replay-safe).
    /// @return valid True iff the signature is from the registered signer, the
    ///         verdict is unexpired, and the nonce is fresh.
    function verifyVerdict(Verdict calldata verdict) external returns (bool valid);

    /// @notice Recover the signer address of a verdict without marking it used.
    function recoverVerdictSigner(Verdict calldata verdict) external view returns (address);

    function proposeSigner(address newSigner) external;
    function executeSigner() external;
    function cancelSignerProposal() external;
    function pendingSigner() external view returns (address);
}
