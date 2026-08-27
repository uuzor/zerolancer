// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPointsLedger} from "./IPointsLedger.sol";

/// @title PointsLedger
/// @notice Shared points accounting per wave. Points are frozen once a wave's
///         evaluation closes (freezeWave). Points never carry over across waves.
/// @dev Deployed as an embedded non-upgradeable contract owned by the WaveProgram
///      which deploys it. Full per-award rows are stored on 0G Storage KV (off-chain
///      indexer reads them); on-chain keeps running totals only. Only the
///      authorized `waveOperator` (the WaveProgram) can award points.
contract PointsLedger is IPointsLedger {
    address public owner;
    mapping(uint256 => uint256) internal totalPointsByWave;
    mapping(uint256 => mapping(address => uint256)) internal pointsByContributor;
    mapping(uint256 => bool) internal frozenByWave;
    address internal operator;

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotAuthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    function setWaveOperator(address op) external onlyOwner {
        operator = op;
    }

    function waveOperator() external view returns (address) {
        return operator;
    }

    function awardBase(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external onlyOperator {
        _award(waveId, contributor, points, AwardKind.Base, refHash);
    }

    function awardCompliment(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external onlyOperator {
        _award(waveId, contributor, points, AwardKind.Compliment, refHash);
    }

    function awardCommunity(
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external onlyOperator {
        _award(waveId, contributor, points, AwardKind.Community, refHash);
    }

    function _award(
        uint256 waveId,
        address contributor,
        uint256 points,
        AwardKind kind,
        bytes32 refHash
    ) internal {
        if (frozenByWave[waveId]) revert WaveFrozen();
        if (points == 0) revert ZeroPoints();
        if (contributor == address(0)) revert ZeroAddress();

        totalPointsByWave[waveId] += points;
        pointsByContributor[waveId][contributor] += points;
        emit PointsAwarded(waveId, contributor, kind, uint96(points), refHash);
    }

    function totalPoints(uint256 waveId) external view returns (uint256) {
        return totalPointsByWave[waveId];
    }

    function contributorPoints(uint256 waveId, address contributor)
        external
        view
        returns (uint256)
    {
        return pointsByContributor[waveId][contributor];
    }

    function freezeWave(uint256 waveId) external onlyOperator {
        frozenByWave[waveId] = true;
    }

    function isFrozen(uint256 waveId) external view returns (bool) {
        return frozenByWave[waveId];
    }

    error ZeroAddress();
}