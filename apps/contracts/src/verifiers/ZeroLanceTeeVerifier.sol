// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {TimelockManager} from "../libraries/TimelockManager.sol";
import {BaseVerifier} from "./BaseVerifier.sol";
import {IZeroLanceTeeVerifier} from "../interfaces/IZeroLanceTeeVerifier.sol";
import {
    TransferValidityProof,
    TransferValidityProofOutput
} from "../interfaces/IERC7857DataVerifier.sol";

using TimelockManager for TimelockManager.State;

/// @title ZeroLanceTeeVerifier
/// @notice TEE-based verifier for AI verdicts and ERC-7857 transfer-validity proofs.
/// @dev Adapted from axiom-protocol's AxiomTeeVerifier (MIT).
/// @dev In production, the registered signer is the public key of an Intel TDX/AMD SEV
///      TEE running the oracle service. For devnet it is a Node.js signer (apps/oracle)
///      holding a secp256k1 keypair whose address is registered via proposeSigner + executeSigner.
/// @dev Verdicts are signed over the EIP-712 `Verdict` struct:
///        keccak256(abi.encodePacked("\x19\x01", domainSeparator,
///          keccak256(abi.encode(VERDICT_TYPEHASH, taskId, deliverableHash, passed, score, nonce, validUntil))))
/// @dev Transfer-validity proofs (OwnershipProof / AccessProof) are signed over the
///      same EIP-712 domain, mirroring the ERC-7857 canonical flow.
contract ZeroLanceTeeVerifier is
    Initializable,
    BaseVerifier,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IZeroLanceTeeVerifier
{
    error AxiomInvalidSigner();
    error AxiomInvalidOwnershipProof();
    error AxiomInvalidAccessProof();
    error ZeroAddress();
    /// @dev Thrown when the accessProof and ownershipProof fields that must
    ///      be identical (dataHash, targetPubkey, nonce, validUntil) do not match.
    error ProofFieldMismatch();
    error AxiomProofExpired(uint256 validUntil, uint256 blockTimestamp);
    error AxiomValidUntilTooFar(uint256 validUntil, uint256 blockTimestamp, uint256 maxProofAgeSeconds);

    /// @dev Set once at deployment; immutable so it is baked into the deployed bytecode.
    uint256 public maxProofAgeSeconds;
    address public registeredSigner;
    TimelockManager.State private _signerTimelock;

    /// @dev EIP-712 domain binds signatures to this contract instance and chain,
    ///      preventing cross-contract and cross-chain replay.
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant VERDICT_TYPEHASH = keccak256(
        "Verdict(uint256 taskId,bytes32 deliverableHash,bool passed,uint256 score,bytes32 nonce,uint256 validUntil)"
    );
    bytes32 private constant OWNERSHIP_PROOF_TYPEHASH = keccak256(
        "OwnershipProof(bytes32 dataHash,bytes sealedKey,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"
    );
    bytes32 private constant ACCESS_PROOF_TYPEHASH = keccak256(
        "AccessProof(bytes32 dataHash,bytes targetPubkey,address to,address nft,bytes nonce,uint256 validUntil)"
    );

    constructor() {
        _disableInitializers();
    }

    /// @param _owner Address that owns the contract (onlyOwner).
    /// @param _signer Initial TEE signer address (the oracle's secp256k1 public key as an address).
    /// @param _maxProofAge Maximum proof age in seconds (canonical 0G reference uses 7 days).
    function initialize(address _owner, address _signer, uint256 _maxProofAge) external initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_signer == address(0)) revert ZeroAddress();
        __Ownable_init(_owner);
        maxProofAgeSeconds = _maxProofAge;
        registeredSigner = _signer;
    }

    function proposeSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        _signerTimelock.propose(newSigner);
        emit SignerProposed(newSigner, block.timestamp + TimelockManager.DELAY);
    }

    function executeSigner() external onlyOwner {
        address newSigner = _signerTimelock.execute();
        address old = registeredSigner;
        registeredSigner = newSigner;
        emit SignerExecuted(old, newSigner);
    }

    function cancelSignerProposal() external onlyOwner {
        address cancelled = _signerTimelock.proposed;
        _signerTimelock.cancel();
        emit SignerProposalCancelled(cancelled);
    }

    function pendingSigner() external view returns (address) {
        return _signerTimelock.proposed;
    }

    /// @notice Domain separator (EIP-712). Off-chain signers (oracle, browser wallet)
    ///         MUST compute the same digest.
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256("ZeroLanceTeeVerifier"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /// @dev The EIP-712 struct hash for a verdict. bytes32 fields are already hashed;
    ///      scalars (taskId, score, validUntil) are encoded directly. `passed` is a bool.
    function verdictStructHash(Verdict calldata v) public pure returns (bytes32) {
        return keccak256(
            abi.encode(VERDICT_TYPEHASH, v.taskId, v.deliverableHash, v.passed, v.score, v.nonce, v.validUntil)
        );
    }

    function verdictMessageHash(Verdict calldata v) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), verdictStructHash(v)));
    }

    function recoverVerdictSigner(Verdict calldata v) public view returns (address) {
        if (v.signature.length != 65) revert AxiomInvalidSigner();
        address recovered = ECDSA.recover(verdictMessageHash(v), v.signature);
        if (recovered == address(0)) revert AxiomInvalidSigner();
        return recovered;
    }

    /// @inheritdoc IZeroLanceTeeVerifier
    function verifyVerdict(Verdict calldata verdict) external returns (bool valid) {
        uint256 nowTs = block.timestamp;
        // Freshness gate: unexpired and not too far in the future.
        if (verdict.validUntil < nowTs) revert AxiomProofExpired(verdict.validUntil, nowTs);
        if (verdict.validUntil - nowTs > maxProofAgeSeconds) {
            revert AxiomValidUntilTooFar(verdict.validUntil, nowTs, maxProofAgeSeconds);
        }

        address signer = recoverVerdictSigner(verdict);
        if (signer != registeredSigner) return false;

        // Replay protection: one verdict per nonce.
        bytes32 key = keccak256(abi.encode(verdict.taskId, verdict.deliverableHash, verdict.nonce));
        _checkAndMarkProof(key);
        return true;
    }

    /// @dev Verifies a batch of AccessProof + OwnershipProof pairs against the
    ///      registered TEE signer. Each proof is EIP-712 typed-data signed.
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs,
        address to,
        address nft
    ) external override returns (TransferValidityProofOutput[] memory outputs) {
        address expectedSigner = registeredSigner;
        uint256 maxAge = maxProofAgeSeconds;
        uint256 nowTs = block.timestamp;
        outputs = new TransferValidityProofOutput[](proofs.length);

        bytes32 domainSep = domainSeparator();

        for (uint256 i = 0; i < proofs.length; i++) {
            TransferValidityProof calldata p = proofs[i];

            _checkValidUntil(p.ownershipProof.validUntil, nowTs, maxAge);
            _checkValidUntil(p.accessProof.validUntil, nowTs, maxAge);

            // Cross-proof consistency: shared fields must match.
            if (
                p.accessProof.dataHash != p.ownershipProof.dataHash
                    || keccak256(p.accessProof.targetPubkey) != keccak256(p.ownershipProof.targetPubkey)
                    || keccak256(p.accessProof.nonce) != keccak256(p.ownershipProof.nonce)
                    || p.accessProof.validUntil != p.ownershipProof.validUntil
            ) {
                revert ProofFieldMismatch();
            }

            // 1. Verify OwnershipProof — signed by the TEE oracle via EIP-712.
            bytes32 ownershipMessage = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSep,
                    keccak256(
                        abi.encode(
                            OWNERSHIP_PROOF_TYPEHASH,
                            p.ownershipProof.dataHash,
                            keccak256(p.ownershipProof.sealedKey),
                            keccak256(p.ownershipProof.targetPubkey),
                            to,
                            nft,
                            keccak256(p.ownershipProof.nonce),
                            p.ownershipProof.validUntil
                        )
                    )
                )
            );
            address recovered = _recoverSigner(ownershipMessage, p.ownershipProof.proof);
            if (recovered != expectedSigner) revert AxiomInvalidOwnershipProof();

            // 2. Verify AccessProof — signed by the receiver via EIP-712.
            bytes32 accessMessage = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSep,
                    keccak256(
                        abi.encode(
                            ACCESS_PROOF_TYPEHASH,
                            p.accessProof.dataHash,
                            keccak256(p.accessProof.targetPubkey),
                            to,
                            nft,
                            keccak256(p.accessProof.nonce),
                            p.accessProof.validUntil
                        )
                    )
                )
            );
            address accessSigner = _recoverSigner(accessMessage, p.accessProof.proof);
            if (accessSigner == address(0) || accessSigner != to) revert AxiomInvalidAccessProof();

            // 3. Mark proof nonce as used (replay protection).
            bytes32 proofNonce = keccak256(
                abi.encode(
                    p.accessProof.dataHash,
                    p.accessProof.targetPubkey,
                    p.ownershipProof.sealedKey,
                    p.accessProof.nonce,
                    p.accessProof.validUntil
                )
            );
            _checkAndMarkProof(proofNonce);

            // 4. Populate the output struct.
            outputs[i] = TransferValidityProofOutput({
                dataHash: p.ownershipProof.dataHash,
                sealedKey: p.ownershipProof.sealedKey,
                targetPubkey: p.ownershipProof.targetPubkey,
                wantedKey: "",
                accessAssistant: accessSigner,
                accessProofNonce: p.accessProof.nonce,
                ownershipProofNonce: p.ownershipProof.nonce
            });
        }
    }

    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert AxiomInvalidSigner();
        address recovered = ECDSA.recover(messageHash, signature);
        if (recovered == address(0)) revert AxiomInvalidSigner();
        return recovered;
    }

    function _checkValidUntil(uint256 validUntil, uint256 nowTs, uint256 maxAge) internal pure {
        if (validUntil < nowTs) {
            revert AxiomProofExpired(validUntil, nowTs);
        }
        if (validUntil - nowTs > maxAge) {
            revert AxiomValidUntilTooFar(validUntil, nowTs, maxAge);
        }
    }

    /// @dev Required by BaseVerifier.
    function _getMaxProofAge() internal view override returns (uint256) {
        return maxProofAgeSeconds;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[50] private __gap;
}
