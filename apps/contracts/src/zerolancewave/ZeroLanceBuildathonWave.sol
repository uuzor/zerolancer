// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IWaveFundingVerifier} from "./IWaveFundingVerifier.sol";
import {IZeroLanceBuildathonWave} from "./IZeroLanceBuildathonWave.sol";

/// @title ZeroLanceBuildathonWave
/// @notice Buildathon mode. Teams register products; per-wave submissions earn
///         judge and community points via the verifier's award paths.
contract ZeroLanceBuildathonWave is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceBuildathonWave
{
    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceBuildathonWave
    struct BuildStorage {
        IWaveFundingVerifier verifier;
        uint256 nextTeamId;
        uint256 nextSubId;
        mapping(uint256 => Team) teams;
        mapping(uint256 => Submission) submissions;
        uint256[46] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x8c5f3a0e7b9d6c4f1e2a8b3c0d5e7f9a1b4c6d8e0f2a3b5c7d9e1f0a2b4c6d8e;

    function _getStorage() private pure returns (BuildStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address verifier_) external initializer {
        if (admin == address(0) || verifier_ == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        _getStorage().verifier = IWaveFundingVerifier(verifier_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) revert ZeroAddress();
        _getStorage().verifier = IWaveFundingVerifier(verifier_);
    }

    function _organizerOf(uint256 programId) internal view returns (address) {
        return _getStorage().verifier.program(programId).organizer;
    }

    function _isAwarder(uint256 programId, address who) internal view returns (bool) {
        IWaveFundingVerifier v = _getStorage().verifier;
        return who == v.program(programId).organizer;
    }

    function registerTeam(uint256 programId, address wallet, string calldata repoUrl)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 teamId)
    {
        if (msg.sender != _organizerOf(programId)) revert NotOrganizer();
        if (wallet == address(0)) revert ZeroAddress();
        if (bytes(repoUrl).length == 0) revert ZeroAddress();

        BuildStorage storage $ = _getStorage();
        teamId = $.nextTeamId++;
        bytes32 repoHash = keccak256(bytes(repoUrl));
        $.teams[teamId] = Team({programId: programId, wallet: wallet, repoHash: repoHash, repoUrl: repoUrl});
        emit TeamRegistered(programId, teamId, wallet, repoHash, repoUrl);
    }

    function submit(uint256 programId, uint256 teamId, bytes32 contentHash, bytes32 repoHash)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 subId)
    {
        BuildStorage storage $ = _getStorage();
        Team storage t = $.teams[teamId];
        if (t.wallet == address(0)) revert TeamNotFound();
        if (t.programId != programId) revert TeamNotFound();
        if (msg.sender != t.wallet && msg.sender != _organizerOf(programId)) revert NotTeamLead();

        uint256 waveId = $.verifier.currentOpenWave(programId);
        if (waveId == 0) revert NoWaveOpen();

        subId = $.nextSubId++;
        $.submissions[subId] = Submission({
            programId: programId,
            waveId: waveId,
            teamId: teamId,
            contentHash: contentHash,
            repoHash: repoHash,
            points: 0
        });

        emit SubmissionCreated(programId, waveId, subId, teamId, contentHash, repoHash);
    }

    function setSubmissionPoints(uint256 programId, uint256 subId, uint256 points)
        external
        whenNotPaused
        nonReentrant
    {
        BuildStorage storage $ = _getStorage();
        if (!_isAwarder(programId, msg.sender)) revert NotOrganizer();
        Submission storage s = $.submissions[subId];
        if (s.teamId == 0) revert SubmissionNotFound();
        if (s.programId != programId) revert SubmissionNotFound();
        if (points == 0) revert ZeroPoints();

        Team storage t = $.teams[s.teamId];
        bytes32 subHash = keccak256(abi.encode(subId, s.contentHash));
        s.points += points;
        emit SubmissionScored(subId, points);
        $.verifier.awardBase(s.waveId, t.wallet, points, subHash);
    }

    function castVote(uint256 programId, uint256 subId, uint256 weight) external whenNotPaused nonReentrant {
        BuildStorage storage $ = _getStorage();
        Submission storage s = $.submissions[subId];
        if (s.teamId == 0) revert SubmissionNotFound();
        if (s.programId != programId) revert SubmissionNotFound();
        if (weight == 0) revert ZeroPoints();

        Team storage t = $.teams[s.teamId];
        bytes32 voterHash = keccak256(abi.encode(subId, msg.sender));
        emit VoteCast(subId, msg.sender, weight);
        $.verifier.awardCommunity(s.waveId, t.wallet, weight, voterHash);
    }

    function team(uint256 teamId) external view returns (Team memory) {
        Team memory t = _getStorage().teams[teamId];
        if (t.wallet == address(0)) revert TeamNotFound();
        return t;
    }

    function submission(uint256 subId) external view returns (Submission memory) {
        Submission memory s = _getStorage().submissions[subId];
        if (s.teamId == 0) revert SubmissionNotFound();
        return s;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}