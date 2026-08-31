// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceBuildathonWave
/// @notice Buildathon mode (Akindo/WaveHack style). Teams register products,
///         submit per-wave demos/updates, and earn judge + community points.
interface IZeroLanceBuildathonWave {
    struct Team {
        uint256 programId;
        address wallet;
        bytes32 repoHash;
        string repoUrl;
    }

    struct Submission {
        uint256 programId;
        uint256 waveId;
        uint256 teamId;
        bytes32 contentHash;
        bytes32 repoHash;
        uint256 points;
    }

    event TeamRegistered(
        uint256 indexed programId,
        uint256 indexed teamId,
        address indexed wallet,
        bytes32 repoHash,
        string repoUrl
    );
    event SubmissionCreated(
        uint256 indexed programId,
        uint256 indexed waveId,
        uint256 indexed subId,
        uint256 teamId,
        bytes32 contentHash,
        bytes32 repoHash
    );
    event SubmissionScored(uint256 indexed subId, uint256 points);
    event VoteCast(uint256 indexed subId, address indexed voter, uint256 weight);

    error ZeroAddress();
    error NotOrganizer();
    error NotTeamLead();
    error TeamNotFound();
    error SubmissionNotFound();
    error NoWaveOpen();
    error AlreadyScored();
    error ZeroPoints();

    function initialize(address admin, address verifier) external;

    function registerTeam(uint256 programId, address wallet, string calldata repoUrl)
        external
        returns (uint256 teamId);

    function submit(uint256 programId, uint256 teamId, bytes32 contentHash, bytes32 repoHash)
        external
        returns (uint256 subId);

    function setSubmissionPoints(uint256 programId, uint256 subId, uint256 points) external;
    function castVote(uint256 programId, uint256 subId, uint256 weight) external;

    function team(uint256 teamId) external view returns (Team memory);
    function submission(uint256 subId) external view returns (Submission memory);
}