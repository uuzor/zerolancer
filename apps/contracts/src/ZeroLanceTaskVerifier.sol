// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZeroLanceTaskRegistry} from "./interfaces/IZeroLanceTaskRegistry.sol";
import {IZeroLanceTaskEscrow} from "./interfaces/IZeroLanceTaskEscrow.sol";
import {IZeroLanceTaskVerifier} from "./interfaces/IZeroLanceTaskVerifier.sol";
import {IZeroLanceTeeVerifier} from "./interfaces/IZeroLanceTeeVerifier.sol";
import {IZeroLanceArbitration} from "./interfaces/IZeroLanceArbitration.sol";
import {IZeroLanceReputationNFT} from "./interfaces/IZeroLanceReputationNFT.sol";

/// @title ZeroLanceTaskVerifier
/// @notice Task lifecycle orchestrator. Bridges registry, TEE verifier, escrow,
///         arbitration, and reputation NFT. Holds operator role for reputation
///         minting after a passed verdict.
contract ZeroLanceTaskVerifier is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceTaskVerifier
{
    uint256 public constant RETRY_WINDOW = 14 days;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceTaskVerifier
    struct VerifierStorage {
        IZeroLanceTaskRegistry taskRegistry;
        IZeroLanceTeeVerifier teeVerifier;
        IZeroLanceTaskEscrow taskEscrow;
        IZeroLanceArbitration arbitration;
        IZeroLanceReputationNFT reputationNft;
        mapping(uint256 => bool) verdictFailed;
        mapping(uint256 => uint256) verdictSubmittedAt;
        mapping(address => bool) operator;
        uint256[42] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x3f8e2c5d7a9b1c4e6f0d2a5b8c1e4f7a0d3b6c9e2f5a8b1d4e7f0c3a6b9d2e5f;

    function _getStorage() private pure returns (VerifierStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address taskRegistry_,
        address teeVerifier_,
        address taskEscrow_,
        address reputationNft_,
        address arbitration_
    ) external initializer {
        if (
            admin == address(0) || taskRegistry_ == address(0) || teeVerifier_ == address(0)
                || taskEscrow_ == address(0) || arbitration_ == address(0)
        ) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        VerifierStorage storage $ = _getStorage();
        $.taskRegistry = IZeroLanceTaskRegistry(taskRegistry_);
        $.teeVerifier = IZeroLanceTeeVerifier(teeVerifier_);
        $.taskEscrow = IZeroLanceTaskEscrow(taskEscrow_);
        $.arbitration = IZeroLanceArbitration(arbitration_);
        $.reputationNft = IZeroLanceReputationNFT(reputationNft_);
    }

    function setOperator(address who, bool allowed) external onlyOwner {
        if (who == address(0)) revert ZeroAddress();
        _getStorage().operator[who] = allowed;
        emit OperatorSet(who, allowed);
    }

    modifier onlyOperator() {
        if (!_getStorage().operator[msg.sender]) revert NotOperator();
        _;
    }

    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external whenNotPaused {
        VerifierStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (msg.sender != t.freelancer) revert NotFreelancer();
        if (t.status != IZeroLanceTaskRegistry.TaskStatus.Assigned) revert WrongStatus();
        $.taskRegistry.submitDeliverable(taskId, deliverableHash, prNumber);
        emit DeliverableSubmitted(taskId, deliverableHash, prNumber);
    }

    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict)
        external
        nonReentrant
        whenNotPaused
    {
        VerifierStorage storage $ = _getStorage();
        if (verdict.taskId >= $.taskRegistry.nextTaskId()) revert WrongStatus();
        IZeroLanceTaskRegistry.Task memory task = $.taskRegistry.taskOf(verdict.taskId);
        if (task.status != IZeroLanceTaskRegistry.TaskStatus.InReview) revert WrongStatus();
        if (task.deliverableHash != verdict.deliverableHash) revert DeliverableMismatch();

        if (!$.teeVerifier.verifyVerdict(verdict)) revert NotAuthorizedVerifier();

        if (verdict.passed) {
            address treasury = $.taskEscrow.treasury();
            uint16 feeBps = $.taskEscrow.protocolFeeBps();
            $.taskRegistry.setStatus(verdict.taskId, IZeroLanceTaskRegistry.TaskStatus.Passed);
            $.taskEscrow.release(verdict.taskId, task.freelancer, uint16(feeBps), treasury);
        } else {
            $.verdictFailed[verdict.taskId] = true;
            $.verdictSubmittedAt[verdict.taskId] = block.timestamp;
            $.taskRegistry.setStatus(verdict.taskId, IZeroLanceTaskRegistry.TaskStatus.Disputed);
        }
        emit VerdictSubmitted(verdict.taskId, verdict.passed, verdict.score);
    }

    function escalateDispute(uint256 taskId, address[] calldata arbiters) external whenNotPaused {
        VerifierStorage storage $ = _getStorage();
        if (!$.verdictFailed[taskId]) revert WrongStatus();
        if (block.timestamp < $.verdictSubmittedAt[taskId] + RETRY_WINDOW) revert RetryWindowOpen();
        if (arbiters.length == 0) revert ZeroAddress();
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Disputed);
        $.arbitration.openDispute(taskId, arbiters);
        emit DisputeEscalated(taskId);
    }

    function mintReputationForTask(uint256 taskId, string calldata dataDescription, bytes32 dataHash)
        external
        whenNotPaused
        onlyOperator
        returns (uint256 tokenId)
    {
        VerifierStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        tokenId = $.reputationNft.mintReputation(t.freelancer, taskId, dataDescription, dataHash);
        emit ReputationMinted(taskId, tokenId, t.freelancer);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}