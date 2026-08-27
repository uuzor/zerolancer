// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceWaveBuildathon
/// @notice Buildathon mode (Akindo/WaveHack style). Teams register products, submit
///         per-wave demos/updates, and earn judge points; distribution routes through
///         the shared ZeroLanceWaveProgram proportional to points.
interface IZeroLanceWaveBuildathon {
    struct Submission {
        uint256 programId;
        uint256 waveId;
        uint256 teamId;
        bytes32 contentHash; // demo/description/metrics on 0G Storage
        bytes32 repoHash; // product repo
        uint256 points;
    }

    event TeamRegistered(uint256 indexed programId, uint256 indexed teamId, address indexed team);
    event SubmissionCreated(
        uint256 indexed programId,
        uint256 indexed waveId,
        uint256 indexed subId,
        uint256 teamId
    );
    event SubmissionScored(uint256 indexed subId, uint256 points);
    event VoteCast(
        uint256 indexed subId,
        address indexed voter,
        uint256 weight
    );

    error NotOrganizer();
    error NotJudge();
    error TeamNotFound();
    error SubmissionNotFound();
    error NoWaveOpen();
    error AlreadyScored();
    error ZeroPoints();

    function registerTeam(uint256 programId, address team, bytes32 productRepoHash) external returns (uint256 teamId);

    function submit(
        uint256 programId,
        uint256 teamId,
        bytes32 contentHash,
        bytes32 repoHash
    ) external returns (uint256 subId);

    /// @notice Assign judge points to a submission (organizer or grant-judge).
    function setSubmissionPoints(uint256 programId, uint256 subId, uint256 points) external;

    /// @notice Community weighted vote during the evaluation window.
    function castVote(uint256 programId, uint256 subId, uint256 weight) external;
}