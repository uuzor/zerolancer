// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPointsLedger
/// @notice Shared points accounting for Wave funding modes (Wave Issue + Wave Buildathon).
///         Points do NOT carry over across Waves. Base + bonus/compliment points are
///         tracked per contributor per wave.
interface IPointsLedger {
    enum AwardKind {
        Base,
        Compliment,
        Community // weighted community votes (Buildathon)
    }

    event PointsAwarded(
        uint256 indexed waveId,
        address indexed contributor,
        AwardKind kind,
        uint96 points,
        bytes32 refHash
    );

    error WaveFrozen();
    error NotAuthorized();
    error ZeroPoints();

    function awardBase(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external;

    function awardCompliment(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external;

    function awardCommunity(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external;

    function totalPoints(uint256 waveId) external view returns (uint256);

    function contributorPoints(uint256 waveId, address contributor)
        external
        view
        returns (uint256);

    function isFrozen(uint256 waveId) external view returns (bool);

    function freezeWave(uint256 waveId) external;

    function setWaveOperator(address op) external;
}