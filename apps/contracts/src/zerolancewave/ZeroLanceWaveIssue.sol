// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZeroLanceWaveProgram} from "./IZeroLanceWaveProgram.sol";
import {ZeroLanceWaveProgram} from "./ZeroLanceWaveProgram.sol";
import {IZeroLanceWaveIssue} from "./IZeroLanceWaveIssue.sol";

/// @title ZeroLanceWaveIssue
/// @notice Wave Issue mode. Uses the shared ZeroLanceWaveProgram lifecycle for
///         waves + points + distribution, and adds issue-level state: repo
///         acceptance, AI-suggested base points, claim, PR submission, maintainer
///         merge confirmation (awards points), and compliments.
contract ZeroLanceWaveIssue is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveIssue
{

    uint256 public constant MAX_BASE_POINTS = 200;

    struct Storage {
        uint256 nextIssueId;
        address waveProgram;
        mapping(uint256 => Issue) issues;
        address manager; // contract that may drive issue state (backend/oracle)
        uint256[47] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x0ad862d3b95737e8b5e90ed351952654e65ce56a1942d7d4a10cb46977703a34; // erc7201:zerolance.zerolancewave.issue.v1

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

    modifier onlyManager() {
        if (msg.sender != _getStorage().manager && msg.sender != owner()) revert NotManager();
        _;
    }

    function setManager(address m) external onlyOwner {
        _getStorage().manager = m;
    }

    function acceptRepo(uint256 programId, bytes32 repoHash, bool allowed) external {
        ZeroLanceWaveProgram(_getStorage().waveProgram).approveRepo(programId, repoHash, allowed);
        emit RepoAccepted(programId, repoHash);
    }

    function createIssue(
        uint256 programId,
        bytes32 repoHash,
        bytes32 specHash,
        uint256 basePoints,
        uint64 complexity
    ) external returns (uint256 issueId) {
        if (basePoints == 0 || basePoints > MAX_BASE_POINTS) revert InvalidPoints();
        // Only accepted repos can host issues.
        if (!ZeroLanceWaveProgram(_getStorage().waveProgram).approved(programId, repoHash)) {
            revert RepoNotAccepted();
        }
        // Must be the program organizer or the maintainer (we allow the caller if
        // their repo is approved; the backend authorizes maintainers).
        Storage storage $ = _getStorage();
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
            state: 0,
            pointsAwarded: false
        });
        emit IssueCreated(programId, issueId, msg.sender, basePoints, repoHash);
    }

    function setIssuePoints(uint256 issueId, uint256 basePoints) external {
        Issue storage it = _getIssue(issueId);
        if (msg.sender != it.maintainer) revert NotMaintainer();
        if (it.state != uint8(IssueState.Created)) revert PointsLocked();
        if (basePoints == 0 || basePoints > MAX_BASE_POINTS) revert InvalidPoints();
        it.basePoints = basePoints;
        emit IssuePointsSet(issueId, basePoints);
    }

    function claimIssue(uint256 issueId) external {
        Issue storage it = _getIssue(issueId);
        if (it.state != uint8(IssueState.Created)) {
            revert WrongIssueState(IssueState.Created, IssueState(it.state));
        }
        // Lock the issue to the open wave in its program.
        (uint256 waveId, bool isOpen) = currentWave(it.programId);
        if (!isOpen) revert NoWaveOpen();
        it.waveId = waveId;
        it.builder = msg.sender;
        it.state = uint8(IssueState.Claimed);
        emit IssueClaimed(issueId, msg.sender, waveId);
    }

    function submitPr(uint256 issueId, bytes32 deliverableHash, uint64 prNumber) external {
        Issue storage it = _getIssue(issueId);
        if (msg.sender != it.builder) revert NotBuilder();
        if (it.state != uint8(IssueState.Claimed)) {
            revert WrongIssueState(IssueState.Claimed, IssueState(it.state));
        }
        it.deliverableHash = deliverableHash;
        it.deliveredPr = prNumber;
        it.state = uint8(IssueState.PrSubmitted);
        emit IssuePrSubmitted(issueId, deliverableHash, prNumber);
    }

    /// @notice Maintainer (or manager) confirms the PR merged; awards base points
    ///         to the builder via the program's points ledger, against the locked wave.
    function confirmMerge(uint256 issueId) external {
        Issue storage it = _getIssue(issueId);
        if (msg.sender != it.maintainer && msg.sender != _getStorage().manager) revert NotMaintainer();
        if (it.state != uint8(IssueState.PrSubmitted)) {
            revert WrongIssueState(IssueState.PrSubmitted, IssueState(it.state));
        }
        it.state = uint8(IssueState.Awarded);
        it.pointsAwarded = true;
        uint256 total = it.basePoints + it.bonusPoints;
        ZeroLanceWaveProgram(_getStorage().waveProgram).awardBase(
            it.programId,
            it.waveId,
            it.builder,
            total,
            bytes32(issueId)
        );
        emit IssueMerged(issueId, it.builder, total);
    }

    function addCompliment(uint256 issueId, uint256 points) external {
        Issue storage it = _getIssue(issueId);
        if (msg.sender != it.maintainer && msg.sender != _getStorage().manager) revert NotMaintainer();
        if (it.state != uint8(IssueState.Awarded)) {
            revert WrongIssueState(IssueState.Awarded, IssueState(it.state));
        }
        if (points == 0) revert InvalidPoints();
        it.bonusPoints += points;
        // Compliment awarded to the same wave (points ledger handles the window).
        ZeroLanceWaveProgram(_getStorage().waveProgram).awardCompliment(
            it.programId,
            it.waveId,
            it.builder,
            points,
            bytes32(issueId)
        );
        emit ComplimentAdded(issueId, points);
    }

    function issue(uint256 issueId) external view returns (Issue memory) {
        return _getIssueValue(issueId);
    }

    // ── Views / helpers ──────────────────────────────────────────────────

    function currentWave(uint256 programId)
        public
        view
        returns (uint256 waveId, bool isOpen)
    {
        ZeroLanceWaveProgram prog = ZeroLanceWaveProgram(_getStorage().waveProgram);
        IZeroLanceWaveProgram.Program memory p = prog.program(programId);
        if (p.waveSeq == 0) return (0, false);
        waveId = p.currentWave;
        IZeroLanceWaveProgram.Wave memory w = prog.wave(waveId);
        isOpen = w.status == IZeroLanceWaveProgram.WaveStatus.Open;
    }

    function _getIssue(uint256 issueId) internal view returns (Issue storage it) {
        it = _getStorage().issues[issueId];
        if (it.specHash == bytes32(0)) revert IssueNotFound();
    }

    function _getIssueValue(uint256 issueId) internal view returns (Issue memory it) {
        it = _getStorage().issues[issueId];
        if (it.specHash == bytes32(0)) revert IssueNotFound();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    error InvalidPoints();
    error NotManager();
}