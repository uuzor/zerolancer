// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceTaskRegistry
/// @notice Interface for the immutable task specification registry.
/// @dev Task specs are encrypted and stored on 0G Storage; only the specHash is
///      committed on-chain and is immutable after creation.
interface IZeroLanceTaskRegistry {
    enum TaskStatus {
        Open, // created, awaiting freelancer assignment
        Assigned, // freelancer assigned, work in progress
        InReview, // deliverable submitted, awaiting AI verdict
        Passed, // AI verdict = passed, escrow released
        Disputed, // client disputed or retry window elapsed → arbitration
        Resolved, // dispute resolved, funds distributed
        Cancelled // cancelled before assignment, escrow refunded
    }

    enum TaskCategory {
        Code, // GitHub PR + CI gates (unit tests, linting, coverage)
        Design, // ML brand-compliance image checks
        Content, // LLM similarity scoring (writing, translation)
        Community // hybrid AI + community voting
    }

    struct Task {
        address client;
        address freelancer;
        TaskStatus status;
        TaskCategory category;
        bytes32 specHash; // 0G Storage root hash of the encrypted spec (immutable)
        bytes32 deliverableHash; // hash of the submitted deliverable (PR ref / file / URL)
        address paymentToken;
        uint256 reward; // total escrowed reward
        uint256 deadline; // unix seconds
        uint256 createdAt;
        uint256 retryDeadline; // 2 weeks after a failed verdict
        string repoUrl; // GitHub repo (immutable with specHash)
        uint64 issueNumber; // linked GitHub issue
        uint64 prNumber; // linked GitHub PR (set on deliverable submission)
        uint16 coverageGateBps; // minimum coverage threshold (basis points)
    }

    event TaskCreated(
        uint256 indexed taskId,
        address indexed client,
        bytes32 indexed specHash,
        TaskCategory category,
        uint256 reward,
        uint256 deadline,
        string repoUrl,
        uint64 issueNumber
    );
    event TaskAssigned(uint256 indexed taskId, address indexed freelancer);
    event DeliverableSubmitted(uint256 indexed taskId, address indexed freelancer, bytes32 deliverableHash, uint64 prNumber);
    event TaskStatusChanged(uint256 indexed taskId, TaskStatus status);

    function createTask(
        bytes32 specHash,
        TaskCategory category,
        address paymentToken,
        uint256 reward,
        uint256 deadline,
        string calldata repoUrl,
        uint64 issueNumber,
        uint16 coverageGateBps
    ) external returns (uint256 taskId);

    function assignTask(uint256 taskId, address freelancer) external;
    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external;
    function setStatus(uint256 taskId, TaskStatus status) external;
    function setAuthorizedSetter(address setter) external;
    function taskOf(uint256 taskId) external view returns (Task memory);
    function specHashOf(uint256 taskId) external view returns (bytes32);
    function nextTaskId() external view returns (uint256);
}
