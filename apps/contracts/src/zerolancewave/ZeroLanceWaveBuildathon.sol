// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZeroLanceWaveBuildathon} from "./IZeroLanceWaveBuildathon.sol";

/// @title ZeroLanceWaveBuildathon
/// @notice Buildathon mode is now handled off-chain. This contract is a stub
///         kept for ABI compatibility and to allow the deploy script to succeed.
///         All buildathon logic (teams, submissions, judging) lives in the
///         backend database; the contract only anchors references via events.
contract ZeroLanceWaveBuildathon is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveBuildathon
{
    uint256 public nextSubId;
    uint256 public nextTeamId;

    constructor() { _disableInitializers(); }

    function initialize(address admin) external initializer {
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
    }

    function registerTeam(uint256, address, bytes32) external returns (uint256 teamId) {
        teamId = nextTeamId++;
        emit TeamRegistered(0, teamId, msg.sender);
    }

    function submit(uint256, uint256, bytes32, bytes32) external returns (uint256 subId) {
        subId = nextSubId++;
        emit SubmissionCreated(0, 0, subId, 0);
    }

    function setSubmissionPoints(uint256, uint256) external pure {}

    function castVote(uint256, uint256, uint256) external pure {}

    function submission(uint256) external pure returns (Submission memory) {
        return Submission({
            programId: 0,
            waveId: 0,
            teamId: 0,
            contentHash: bytes32(0),
            repoHash: bytes32(0),
            points: 0
        });
    }

    function setJudge(uint256, address, bool) external pure {}

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
