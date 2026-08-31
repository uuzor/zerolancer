// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IWaveFundingVerifier} from "./IWaveFundingVerifier.sol";
import {IZeroLanceOssWave} from "./IZeroLanceOssWave.sol";

/// @title ZeroLanceOssWave
/// @notice OSS wave mode. Anchors issue lifecycle on-chain; awards flow through
///         the WaveFundingVerifier's awardBase/awardCompliment paths.
contract ZeroLanceOssWave is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceOssWave
{
    uint256 public constant MAX_BASE_POINTS = 200;

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceOssWave
    struct OssStorage {
        IWaveFundingVerifier verifier;
        uint256 nextIssueId;
        mapping(uint256 => mapping(bytes32 => bool)) acceptedRepo;
        mapping(uint256 => mapping(address => bool)) programMaintainer;
        mapping(uint256 => Issue) issues;
        uint256[45] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x6f3a1c0e9d8b7a6c5e4f3d2b1a0c9e8f7d6b5a4c3e2f1d0b9a8c7e6f5d4c3b2a;

    function _getStorage() private pure returns (OssStorage storage $) {
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

    function _isMaintainer(uint256 programId, address who) internal view returns (bool) {
        OssStorage storage $ = _getStorage();
        return $.programMaintainer[programId][who] || who == _organizerOf(programId);
    }

    modifier onlyOrganizer(uint256 programId) {
        if (msg.sender != _organizerOf(programId)) revert NotMaintainer();
        _;
    }

    function acceptRepo(uint256 programId, bytes32 repoHash, bool allowed)
        external
        whenNotPaused
        onlyOrganizer(programId)
    {
        if (repoHash == bytes32(0)) revert ZeroAddress();
        _getStorage().acceptedRepo[programId][repoHash] = allowed;
        emit RepoAccepted(programId, repoHash, allowed);
    }

    function grantMaintainer(uint256 programId, address who, bool allowed)
        external
        whenNotPaused
        onlyOrganizer(programId)
    {
        if (who == address(0)) revert ZeroAddress();
        _getStorage().programMaintainer[programId][who] = allowed;
        emit MaintainerSet(programId, who, allowed);
    }

    function createIssue(
        uint256 programId,
        bytes32 repoHash,
        bytes32 specHash,
        uint256 basePoints,
        uint64 complexity
    ) external whenNotPaused nonReentrant returns (uint256 issueId) {
        OssStorage storage $ = _getStorage();
        if (!_isMaintainer(programId, msg.sender)) revert NotMaintainer();
        if (!$.acceptedRepo[programId][repoHash]) revert RepoNotAccepted();
        if (specHash == bytes32(0)) revert ZeroAddress();
        if (basePoints == 0 || basePoints > MAX_BASE_POINTS) revert BasePointsExceedCap();

        issueId = $.nextIssueId++;
        $.issues[issueId] = Issue({
            programId: programId,
            waveId: 0,
            maintainer: msg.sender,
            builder: address(0),
            specHash: specHash,
            repoHash: repoHash,
            basePoints: basePoints,
            bonusPoints: 0,
            deliveredPr: 0,
            deliverableHash: bytes32(0),
            complexity: complexity,
            state: IssueState.Created,
            pointsAwarded: false
        });

        emit IssueCreated(programId, issueId, msg.sender, basePoints, repoHash, specHash);
    }

    function setIssuePoints(uint256 issueId, uint256 basePoints) external whenNotPaused {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        if (!_isMaintainer(i.programId, msg.sender)) revert NotMaintainer();
        if (i.state != IssueState.Created) revert PointsLocked();
        if (basePoints == 0 || basePoints > MAX_BASE_POINTS) revert BasePointsExceedCap();
        i.basePoints = basePoints;
        emit IssuePointsSet(issueId, basePoints);
    }

    function claimIssue(uint256 issueId) external whenNotPaused nonReentrant {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        if (i.state != IssueState.Created) revert WrongIssueState(IssueState.Created, i.state);

        uint256 waveId = $.verifier.currentOpenWave(i.programId);
        if (waveId == 0) revert NoWaveOpen();

        i.builder = msg.sender;
        i.waveId = waveId;
        i.state = IssueState.Claimed;
        emit IssueClaimed(issueId, msg.sender, waveId);
    }

    function submitPr(uint256 issueId, bytes32 deliverableHash, uint64 prNumber) external whenNotPaused {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.builder == address(0)) revert IssueNotFound();
        if (msg.sender != i.builder) revert NotBuilder();
        if (i.state != IssueState.Claimed) revert WrongIssueState(IssueState.Claimed, i.state);
        i.deliverableHash = deliverableHash;
        i.deliveredPr = prNumber;
        i.state = IssueState.PrSubmitted;
        emit IssuePrSubmitted(issueId, deliverableHash, prNumber);
    }

    function confirmMerge(uint256 issueId) external whenNotPaused nonReentrant {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        if (!_isMaintainer(i.programId, msg.sender)) revert NotMaintainer();
        if (i.state != IssueState.PrSubmitted) revert WrongIssueState(IssueState.PrSubmitted, i.state);

        uint256 waveId = i.waveId;
        bytes32 refHash = keccak256(abi.encode(issueId, i.deliverableHash));
        uint256 basePts = i.basePoints;
        uint256 bonusPts = i.bonusPoints;

        i.state = IssueState.Awarded;
        i.pointsAwarded = true;

        if (basePts > 0) {
            $.verifier.awardBase(waveId, i.builder, basePts, refHash);
        }
        if (bonusPts > 0) {
            $.verifier.awardCompliment(waveId, i.builder, bonusPts, refHash);
        }
        emit IssueMerged(issueId, i.builder, basePts + bonusPts);
    }

    function addCompliment(uint256 issueId, uint256 points) external whenNotPaused {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        if (!_isMaintainer(i.programId, msg.sender)) revert NotMaintainer();
        if (i.state != IssueState.PrSubmitted && i.state != IssueState.Awarded) {
            revert PointsLocked();
        }
        if (points == 0) revert ZeroAddress();
        i.bonusPoints += points;
        emit ComplimentAdded(issueId, points);
    }

    function closeIssue(uint256 issueId) external whenNotPaused {
        OssStorage storage $ = _getStorage();
        Issue storage i = $.issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        if (!_isMaintainer(i.programId, msg.sender)) revert NotMaintainer();
        if (i.state == IssueState.Closed) revert WrongIssueState(IssueState.Closed, i.state);
        i.state = IssueState.Closed;
        emit IssueClosed(issueId);
    }

    function acceptedRepo(uint256 programId, bytes32 repoHash) external view returns (bool) {
        return _getStorage().acceptedRepo[programId][repoHash];
    }

    function isMaintainer(uint256 programId, address who) external view returns (bool) {
        return _isMaintainer(programId, who);
    }

    function issue(uint256 issueId) external view returns (Issue memory) {
        Issue memory i = _getStorage().issues[issueId];
        if (i.maintainer == address(0)) revert IssueNotFound();
        return i;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}