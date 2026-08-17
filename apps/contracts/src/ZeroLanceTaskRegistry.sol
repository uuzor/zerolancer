// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {IZeroLanceTaskRegistry} from "./interfaces/IZeroLanceTaskRegistry.sol";

/// @title ZeroLanceTaskRegistry
/// @notice Immutable task specification registry for the ZeroLance marketplace.
/// @dev The encrypted spec is uploaded to 0G Storage; only the Merkle `specHash`
///      is committed on-chain and is **immutable** after creation (no setter).
///      This enforces the "immutable task specifications" guarantee on-chain.
contract ZeroLanceTaskRegistry is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceTaskRegistry
{
    error ZeroAddress();
    error ZeroAmount();
    error ZeroSpecHash();
    error EmptyRepoUrl();
    error DeadlineInPast();
    error NotClient();
    error NotAssigned();
    error AlreadyAssigned();
    error NotFreelancer();
    error WrongStatus(TaskStatus expected, TaskStatus actual);
    error InvalidCoverageGate();

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceTaskRegistry
    struct TaskRegistryStorage {
        uint256 nextTaskId;
        mapping(uint256 => Task) tasks;
        /// @notice Authorized caller allowed to transition task status (the escrow vault /
        ///         arbitration contract). Decouples on-chain state transitions from clients.
        address authorizedSetters;
        uint256[48] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x2f0bf4b2822c3ab42c2668853c870ac1bf85fef7c9e9704971aa4652a90d0d15; // erc7201:zerolance.storage.ZeroLanceTaskRegistry

    function _getStorage() private pure returns (TaskRegistryStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address authorizedSetters_) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        _getStorage().authorizedSetters = authorizedSetters_;
    }

    function setAuthorizedSetter(address authorizedSetters_) external onlyOwner {
        _getStorage().authorizedSetters = authorizedSetters_;
    }

    function authorizedSetter() external view returns (address) {
        return _getStorage().authorizedSetters;
    }

    /// @inheritdoc IZeroLanceTaskRegistry
    function createTask(
        bytes32 specHash,
        TaskCategory category,
        address paymentToken,
        uint256 reward,
        uint256 deadline,
        string calldata repoUrl,
        uint64 issueNumber,
        uint16 coverageGateBps
    ) external whenNotPaused nonReentrant returns (uint256 taskId) {
        if (specHash == bytes32(0)) revert ZeroSpecHash();
        if (paymentToken == address(0)) revert ZeroAddress();
        if (reward == 0) revert ZeroAmount();
        if (bytes(repoUrl).length == 0) revert EmptyRepoUrl();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (coverageGateBps > 10_000) revert InvalidCoverageGate();

        TaskRegistryStorage storage $ = _getStorage();
        taskId = $.nextTaskId++;
        Task storage t = $.tasks[taskId];
        t.client = msg.sender;
        t.status = TaskStatus.Open;
        t.category = category;
        t.specHash = specHash; // immutable — no setter exists
        t.paymentToken = paymentToken;
        t.reward = reward;
        t.deadline = deadline;
        t.createdAt = block.timestamp;
        t.repoUrl = repoUrl; // immutable alongside specHash
        t.issueNumber = issueNumber;
        t.coverageGateBps = coverageGateBps;

        emit TaskCreated(taskId, msg.sender, specHash, category, reward, deadline, repoUrl, issueNumber);
    }

    /// @inheritdoc IZeroLanceTaskRegistry
    function assignTask(uint256 taskId, address freelancer) external whenNotPaused {
        Task storage t = _getStorage().tasks[taskId];
        if (t.client != msg.sender) revert NotClient();
        if (freelancer == address(0)) revert ZeroAddress();
        if (t.status != TaskStatus.Open) revert AlreadyAssigned();
        t.freelancer = freelancer;
        t.status = TaskStatus.Assigned;
        emit TaskAssigned(taskId, freelancer);
        emit TaskStatusChanged(taskId, TaskStatus.Assigned);
    }

    /// @inheritdoc IZeroLanceTaskRegistry
    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external whenNotPaused {
        TaskRegistryStorage storage $ = _getStorage();
        Task storage t = $.tasks[taskId];
        // Allow the freelancer directly, or the authorized escrow (which already
        // verified the freelancer before delegating).
        if (msg.sender != t.freelancer && msg.sender != $.authorizedSetters) revert NotFreelancer();
        if (t.status != TaskStatus.Assigned) revert WrongStatus(TaskStatus.Assigned, t.status);
        t.deliverableHash = deliverableHash;
        t.prNumber = prNumber;
        t.status = TaskStatus.InReview;
        emit DeliverableSubmitted(taskId, msg.sender, deliverableHash, prNumber);
        emit TaskStatusChanged(taskId, TaskStatus.InReview);
    }

    /// @inheritdoc IZeroLanceTaskRegistry
    /// @dev Only the authorized setter (escrow vault / arbitration) may transition
    ///      status past InReview, so funds and verdicts stay coherent.
    function setStatus(uint256 taskId, TaskStatus status) external {
        TaskRegistryStorage storage $ = _getStorage();
        if (msg.sender != $.authorizedSetters && msg.sender != owner()) {
            revert NotClient();
        }
        Task storage t = $.tasks[taskId];
        TaskStatus old = t.status;
        t.status = status;
        emit TaskStatusChanged(taskId, status);
        // Silence unused-var warning in a way that documents intent.
        if (old == status) {}
    }

    function taskOf(uint256 taskId) external view returns (Task memory) {
        return _getStorage().tasks[taskId];
    }

    function specHashOf(uint256 taskId) external view returns (bytes32) {
        return _getStorage().tasks[taskId].specHash;
    }

    function nextTaskId() external view returns (uint256) {
        return _getStorage().nextTaskId;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
