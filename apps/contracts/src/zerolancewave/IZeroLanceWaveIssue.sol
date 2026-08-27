// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceWaveIssue
/// @notice Wave Issue mode (Drips Wave + AI hybrid). Organizer accepts repos into a
///         Wave program; maintainers create issues with AI-suggested base points
///         (maintainer may override); builders claim, submit PRs, and earn points on
///         successful merge. End-of-wave distribution routes through the shared
///         ZeroLanceWaveProgram proportional to points.
interface IZeroLanceWaveIssue {
    struct Issue {
        uint256 programId;
        uint256 waveId; // 0 until claimed/assigned to a wave
        address maintainer;
        address builder; // address(0) until claimed
        bytes32 specHash; // on-chain anchor: repoUrl + issueNumber + description on 0G Storage
        bytes32 repoHash; // hash of the accepted repo
        uint256 basePoints; // AI-suggested (<=200) or maintainer overridden, locked at claim
        uint256 bonusPoints; // compliments
        uint256 deliveredPr;
        bytes32 deliverableHash;
        uint64 complexity; // 1=trivial 2=medium 3=high
        uint8 state; // 0 created,1 claimed,2 pr-submitted,3 points-awarded,4 closed
        bool pointsAwarded;
    }

    enum IssueState {
        Created,
        Claimed,
        PrSubmitted,
        Awarded,
        Closed
    }

    event RepoAccepted(uint256 indexed programId, bytes32 indexed repoHash);
    event IssueCreated(
        uint256 indexed programId,
        uint256 indexed issueId,
        address indexed maintainer,
        uint256 basePoints,
        bytes32 repoHash
    );
    event IssuePointsSet(uint256 indexed issueId, uint256 basePoints);
    event IssueClaimed(uint256 indexed issueId, address indexed builder, uint256 waveId);
    event IssuePrSubmitted(
        uint256 indexed issueId,
        bytes32 deliverableHash,
        uint64 prNumber
    );
    event IssueMerged(uint256 indexed issueId, address indexed builder, uint256 points);
    event ComplimentAdded(uint256 indexed issueId, uint256 points);

    error NotOrganizer();
    error RepoNotAccepted();
    error IssueNotFound();
    error NotMaintainer();
    error NotBuilder();
    error WrongIssueState(IssueState expected, IssueState actual);
    error NoWaveOpen();
    error PointsLocked();

    function acceptRepo(uint256 programId, bytes32 repoHash, bool allowed) external;

    function createIssue(
        uint256 programId,
        bytes32 repoHash,
        bytes32 specHash,
        uint256 basePoints,
        uint64 complexity
    ) external returns (uint256 issueId);

    function setIssuePoints(uint256 issueId, uint256 basePoints) external;

    function claimIssue(uint256 issueId) external;

    function submitPr(
        uint256 issueId,
        bytes32 deliverableHash,
        uint64 prNumber
    ) external;

    /// @notice Record that a maintainer merged the PR and award points (base + bonus).
    function confirmMerge(uint256 issueId) external;

    function addCompliment(uint256 issueId, uint256 points) external;

    function issue(uint256 issueId) external view returns (Issue memory);
}