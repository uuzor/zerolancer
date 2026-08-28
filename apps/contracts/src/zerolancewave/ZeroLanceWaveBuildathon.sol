// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZeroLanceWaveProgram} from "./IZeroLanceWaveProgram.sol";
import {ZeroLanceWaveProgram} from "./ZeroLanceWaveProgram.sol";
import {IZeroLanceWaveBuildathon} from "./IZeroLanceWaveBuildathon.sol";

/// @title ZeroLanceWaveBuildathon
/// @notice Buildathon mode. Team-led product submissions judged per wave. Uses the
///         shared ZeroLanceWaveProgram for wave lifecycle + points + distribution.
contract ZeroLanceWaveBuildathon is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveBuildathon
{
    struct Storage {
        uint256 nextSubId;
        uint256 nextTeamId;
        address waveProgram;
        mapping(uint256 => Submission) submissions;
        mapping(uint256 => uint256) teamOf; // teamId -> programId
        mapping(uint256 => address) teamOwner; // teamId -> owner address (points recipient)
        mapping(uint256 => mapping(address => uint256)) teamPoints; // submissionId -> voter -> weight
        mapping(uint256 => mapping(address => bool)) judges; // programId -> judge -> allowed
        uint256[45] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x04b78c706e81afad133bc4681cc1e83e86b1548c67c20bc79921bec4bb967555; // erc7201:zerolance.zerolancewave.buildathon.v1

    function _getStorage() private pure returns (Storage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address waveProgram_) external initializer {
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        _getStorage().waveProgram = waveProgram_;
    }

    function registerTeam(uint256 programId, address team, bytes32 productRepoHash)
        external
        returns (uint256 teamId)
    {
        Storage storage $ = _getStorage();
        teamId = $.nextTeamId++;
        $.teamOf[teamId] = programId;
        $.teamOwner[teamId] = team;
        emit TeamRegistered(programId, teamId, team);
    }

    function submit(
        uint256 programId,
        uint256 teamId,
        bytes32 contentHash,
        bytes32 repoHash
    ) external returns (uint256 subId) {
        Storage storage $ = _getStorage();
        if ($.teamOwner[teamId] == address(0)) revert TeamNotFound();
        // Submissions only during an open wave.
        (uint256 waveId, bool isOpen) = currentWave(programId);
        if (!isOpen) revert NoWaveOpen();

        subId = $.nextSubId++;
        $.submissions[subId] = Submission({
            programId: programId,
            waveId: waveId,
            teamId: teamId,
            contentHash: contentHash,
            repoHash: repoHash,
            points: 0
        });
        emit SubmissionCreated(programId, waveId, subId, teamId);
    }

    /// @notice Assign judge points to a submission, routed into the points ledger
    ///         for the submission's wave. During the evaluation window.
    function setSubmissionPoints(uint256 programId, uint256 subId, uint256 points) external {
        Storage storage $ = _getStorage();
        Submission storage s = $.submissions[subId];
        if (s.contentHash == bytes32(0)) revert SubmissionNotFound();
        if (!_isOrganizerOrJudge(programId)) revert NotJudge();

        ZeroLanceWaveProgram(_getStorage().waveProgram).awardCommunity(
            programId,
            s.waveId,
            $.teamOwner[s.teamId],
            points,
            bytes32(subId)
        );
        s.points = s.points + points;
        emit SubmissionScored(subId, points);
    }

    /// @notice Community weighted vote during the evaluation window (points = weight).
    function castVote(uint256 programId, uint256 subId, uint256 weight) external {
        Storage storage $ = _getStorage();
        Submission storage s = $.submissions[subId];
        if (s.contentHash == bytes32(0)) revert SubmissionNotFound();
        if ($.teamPoints[subId][msg.sender] != 0) revert AlreadyScored();
        if (weight == 0) revert ZeroPoints();
        $.teamPoints[subId][msg.sender] = weight;

        ZeroLanceWaveProgram(_getStorage().waveProgram).awardCommunity(
            programId,
            s.waveId,
            $.teamOwner[s.teamId],
            weight,
            bytes32(subId)
        );
        emit VoteCast(subId, msg.sender, weight);
    }

    function submission(uint256 subId) external view returns (Submission memory) {
        return _getStorage().submissions[subId];
    }

    // ── Views / helpers ──────────────────────────────────────────────────

    function currentWave(uint256 programId) public view returns (uint256 waveId, bool isOpen) {
        ZeroLanceWaveProgram prog = ZeroLanceWaveProgram(_getStorage().waveProgram);
        IZeroLanceWaveProgram.Program memory p = prog.program(programId);
        // No wave has been opened yet if the program's wave sequence is empty.
        if (p.waveSeq == 0) return (0, false);
        waveId = p.currentWave;
        IZeroLanceWaveProgram.Wave memory w = prog.wave(waveId);
        isOpen = w.status == IZeroLanceWaveProgram.WaveStatus.Open;
    }

    function _isOrganizerOrJudge(uint256 programId) internal view returns (bool) {
        ZeroLanceWaveProgram prog = ZeroLanceWaveProgram(_getStorage().waveProgram);
        IZeroLanceWaveProgram.Program memory p = prog.program(programId);
        return msg.sender == p.organizer || _getStorage().judges[programId][msg.sender];
    }

    function setJudge(uint256 programId, address judge, bool allowed) external {
        ZeroLanceWaveProgram prog = ZeroLanceWaveProgram(_getStorage().waveProgram);
        if (msg.sender != prog.program(programId).organizer) revert NotOrganizer();
        _getStorage().judges[programId][judge] = allowed;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}