// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceOssWave
/// @notice OSS mode (Drips Wave + AI hybrid). Maintainers create issues on
///         accepted repos; builders claim, submit PRs, and earn base+compliment
///         points on successful merge. All award paths flow through the verifier.
interface IZeroLanceOssWave {
    enum IssueState {
        Created,
        Claimed,
        PrSubmitted,
        Awarded,
        Closed
    }

    struct Issue {
        uint256 programId;
        uint256 waveId;
        address maintainer;
        address builder;
        bytes32 specHash;
        bytes32 repoHash;
        uint256 basePoints;
        uint256 bonusPoints;
        uint64 deliveredPr;
        bytes32 deliverableHash;
        uint64 complexity;
        IssueState state;
        bool pointsAwarded;
    }

    event RepoAccepted(uint256 indexed programId, bytes32 indexed repoHash, bool allowed);
    event MaintainerSet(uint256 indexed programId, address indexed maintainer, bool allowed);
    event IssueCreated(
        uint256 indexed programId,
        uint256 indexed issueId,
        address indexed maintainer,
        uint256 basePoints,
        bytes32 repoHash,
        bytes32 specHash
    );
    event IssuePointsSet(uint256 indexed issueId, uint256 basePoints);
    event IssueClaimed(uint256 indexed issueId, address indexed builder, uint256 waveId);
    event IssuePrSubmitted(uint256 indexed issueId, bytes32 deliverableHash, uint64 prNumber);
    event IssueMerged(uint256 indexed issueId, address indexed builder, uint256 points);
    event ComplimentAdded(uint256 indexed issueId, uint256 points);
    event IssueClosed(uint256 indexed issueId);

    error ZeroAddress();
    error RepoNotAccepted();
    error IssueNotFound();
    error NotMaintainer();
    error NotBuilder();
    error WrongIssueState(IssueState expected, IssueState actual);
    error NoWaveOpen();
    error PointsLocked();
    error BasePointsExceedCap();

    function initialize(address admin, address verifier) external;

    function acceptRepo(uint256 programId, bytes32 repoHash, bool allowed) external;
    function grantMaintainer(uint256 programId, address who, bool allowed) external;

    function createIssue(
        uint256 programId,
        bytes32 repoHash,
        bytes32 specHash,
        uint256 basePoints,
        uint64 complexity
    ) external returns (uint256 issueId);

    function setIssuePoints(uint256 issueId, uint256 basePoints) external;
    function claimIssue(uint256 issueId) external;
    function submitPr(uint256 issueId, bytes32 deliverableHash, uint64 prNumber) external;
    function confirmMerge(uint256 issueId) external;
    function addCompliment(uint256 issueId, uint256 points) external;
    function closeIssue(uint256 issueId) external;

    function acceptedRepo(uint256 programId, bytes32 repoHash) external view returns (bool);
    function isMaintainer(uint256 programId, address who) external view returns (bool);
    function issue(uint256 issueId) external view returns (Issue memory);
}