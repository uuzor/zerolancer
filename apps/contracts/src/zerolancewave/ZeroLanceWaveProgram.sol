// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TimelockManager} from "../libraries/TimelockManager.sol";
import {IPointsLedger} from "./IPointsLedger.sol";
import {PointsLedger} from "./PointsLedger.sol";
import {IZeroLanceWaveProgram} from "./IZeroLanceWaveProgram.sol";

/// @title ZeroLanceWaveProgram
/// @notice Shared Wave funding program. Holds a reward pool, defines a sequence of
///         waves, awards points through a shared PointsLedger, and at each wave's
///         end distributes that wave's budget proportionally to points (claimable).
/// @dev Supports two budget methods:
///         - FixedPerWave: each wave gets `genesisPool / numWaves` (topped up by deposits).
///         - PctOfRemaining: each wave gets an equal slice of whatever remains.
///
///      Modes (Wave Issue / Wave Buildathon) plug into this shared lifecycle. Point
///      awards are routed through the program by authorized awarders during the
///      evaluation (+ optional compliment) window; points then freeze at closeEvaluation.
contract ZeroLanceWaveProgram is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveProgram
{
    using SafeERC20 for IERC20;
    using TimelockManager for TimelockManager.State;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Storage {
        uint256 genesisPool;
        uint256 totalReceived; // genesis + all deposits
        uint256 totalDistributed; // tokens claimed across all finalized waves
        uint256 nextWaveId; // global wave counter
        uint256 nextProgramId;
        bool initializer;
        TimelockManager.State pauseTimelock;
        mapping(uint256 => Program) programs;
        mapping(uint256 => Wave) waves;
        mapping(uint256 => uint256) programOfWave; // waveId -> programId
        mapping(uint256 => mapping(address => bool)) claimedFinalized; // waveId -> who -> claimed
        mapping(uint256 => uint256) finalizedWaveBudget; // waveId -> net budget (after fee)
        mapping(uint256 => uint256) waveSequence; // waveId -> index in program (0-based)
        mapping(uint256 => uint256) rewardedPoints; // waveId -> awarded points (total)
        mapping(uint256 => mapping(address => bool)) awarders; // programId -> awarder addr -> allowed
        mapping(uint256 => mapping(bytes32 => bool)) approvedRepos; // programId -> repoHash -> approved
        uint256[40] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xe7d1ce599715f2d0254dff207ad59daf0b3a2d1818ac635ef3effc283b015936; // erc7201:zerolance.zerolancewave.program.v1

    function _getStorage() private pure returns (Storage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
    }

    // ── Program lifecycle ────────────────────────────────────────────────

    function createWaveProgram(
        address token,
        uint256 genesisPool_,
        uint256 numWaves,
        uint256 buildWindow,
        uint256 evalWindow,
        uint256 complimentWindow,
        BudgetMethod budgetMethod,
        uint16 feeBps,
        address treasury,
        bytes32 /*specHash*/
    ) external nonReentrant returns (uint256 programId) {
        if (token == address(0) || treasury == address(0)) revert ZeroAddress();
        if (numWaves == 0 || buildWindow == 0 || evalWindow == 0) revert InvalidParams();
        if (genesisPool_ == 0) revert InvalidParams();
        if (feeBps > BPS_DENOMINATOR) revert InvalidParams();

        Storage storage $ = _getStorage();
        programId = $.nextProgramId++;
        _createProgram($, token, genesisPool_, numWaves, buildWindow, evalWindow, complimentWindow, budgetMethod, feeBps, treasury, programId);

        // Pull the genesis pool into escrow.
        if (genesisPool_ > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), genesisPool_);
            $.totalReceived += genesisPool_;
        }
    }

    function _createProgram(
        Storage storage $,
        address token,
        uint256 genesisPool_,
        uint256 numWaves,
        uint256 buildWindow,
        uint256 evalWindow,
        uint256 complimentWindow,
        BudgetMethod budgetMethod,
        uint16 feeBps,
        address treasury,
        uint256 programId
    ) internal {
        IPointsLedger points = IPointsLedger(address(new PointsLedger(address(this))));
        PointsLedger(address(points)).setWaveOperator(address(this));

        $.programs[programId] = Program({
            token: token,
            organizer: msg.sender,
            genesisPool: genesisPool_,
            numWaves: numWaves,
            buildWindow: buildWindow,
            evalWindow: evalWindow,
            complimentWindow: complimentWindow,
            budgetMethod: budgetMethod,
            feeBps: feeBps,
            treasury: treasury,
            points: points,
            currentWave: 0,
            waveSeq: 0,
            initialized: true
        });
        emit ProgramCreated(programId, msg.sender);
    }

    function depositPool(uint256 programId, uint256 amount) external nonReentrant {
        Program memory p = _requireProgram(programId);
        if (amount == 0) revert InvalidParams();
        IERC20(p.token).safeTransferFrom(msg.sender, address(this), amount);
        Storage storage $ = _getStorage();
        $.totalReceived += amount;
        emit PoolDeposited(programId, msg.sender, amount);
    }

    // ── Wave lifecycle ───────────────────────────────────────────────────

    function openWave(uint256 programId) external nonReentrant returns (uint256 waveId) {
        Program storage p = _requireProgramStorage(programId);
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (p.initialized && p.waveSeq >= p.numWaves) revert InvalidParams(); // all waves used

        Storage storage $ = _getStorage();
        waveId = $.nextWaveId++;
        $.programOfWave[waveId] = programId;
        $.waveSequence[waveId] = p.waveSeq++;
        p.currentWave = waveId;

        $.waves[waveId] = Wave({
            programId: programId,
            status: WaveStatus.Open,
            buildEndAt: block.timestamp + p.buildWindow,
            evalEndAt: 0,
            complimentEndAt: 0,
            budget: 0,
            totalDistributed: 0,
            finalized: false
        });
        emit WaveOpened(programId, waveId, block.timestamp + p.buildWindow);
    }

    function closeWave(uint256 programId, uint256 waveId) external {
        _onlyOrganizer(programId);
        Wave storage w = _getStorage().waves[waveId];
        _requireExpected(w, programId, WaveStatus.Open);
        w.status = WaveStatus.Evaluation;
        w.evalEndAt = block.timestamp + _requireProgram(programId).evalWindow;
        emit WaveClosed(programId, waveId);
        emit EvaluationOpened(programId, waveId, w.evalEndAt);
    }

    function openEvaluation(uint256 programId, uint256 waveId) external {
        _onlyOrganizer(programId);
        Wave storage w = _getStorage().waves[waveId];
        _requireExpected(w, programId, WaveStatus.Open);
        require(block.timestamp >= w.buildEndAt, "build window not finished");
        w.status = WaveStatus.Evaluation;
        w.evalEndAt = block.timestamp + _requireProgram(programId).evalWindow;
        emit EvaluationOpened(programId, waveId, w.evalEndAt);
    }

    function closeEvaluation(uint256 programId, uint256 waveId) external {
        _onlyOrganizer(programId);
        Wave storage w = _getStorage().waves[waveId];
        _requireExpected(w, programId, WaveStatus.Evaluation);
        require(block.timestamp >= w.evalEndAt, "eval window not finished");
        w.status = WaveStatus.Finalized;
        // Freeze points: no further changes affect the distribution snapshot.
        _requireProgram(programId).points.freezeWave(waveId);
        emit EvaluationClosed(programId, waveId);
    }

    function finalizeWave(uint256 programId, uint256 waveId) external nonReentrant {
        _onlyOrganizer(programId);
        Wave storage w = _getStorage().waves[waveId];
        if (w.programId != programId) revert WaveNotFound();
        if (w.status == WaveStatus.None) revert WaveNotFound();
        if (w.status != WaveStatus.Finalized && !w.finalized) {
            // Allow finalize any time after evaluation closed.
            require(w.status == WaveStatus.Finalized, "evaluation not closed");
        }

        Storage storage $ = _getStorage();
        Program storage p = $.programs[programId];
        uint256 budget = _computeBudget($, programId, p, w);
        w.budget = budget;
        w.finalized = true;
        w.status = WaveStatus.Closed;

        uint256 netBudget = (budget * (BPS_DENOMINATOR - p.feeBps)) / BPS_DENOMINATOR;
        $.finalizedWaveBudget[waveId] = netBudget;
        emit WaveFinalized(programId, waveId, budget);
    }

    function _computeBudget(
        Storage storage $,
        uint256 programId,
        Program storage p,
        Wave storage w
    ) internal view returns (uint256) {
        if (p.budgetMethod == BudgetMethod.FixedPerWave) {
            uint256 fixedBudget = p.genesisPool / p.numWaves;
            uint256 remaining = remainingPool(programId);
            return fixedBudget < remaining ? fixedBudget : remaining;
        }
        // PctOfRemaining: distribute an equal slice of the remaining pool across
        // all waves yet to be finalized in this program. This wave is finalized now.
        uint256 openedWaves = p.waveSeq;
        uint256 finalizedCount = openedWaves - 1; // this wave is the next to finalize
        uint256 remainingWaves = p.numWaves - finalizedCount;
        if (remainingWaves == 0) remainingWaves = 1;
        return remainingPool(programId) / remainingWaves;
    }

    // ── Points routing (authorized awarders) ─────────────────────────────

    function grantAwarder(uint256 programId, address awarder, bool allowed) external {
        _onlyOrganizer(programId);
        _getStorage().awarders[programId][awarder] = allowed;
    }

    function awardBase(
        uint256 programId,
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external {
        _withAwarder(programId, waveId);
        _requireProgram(programId).points.awardBase(waveId, contributor, points, refHash);
    }

    function awardCompliment(
        uint256 programId,
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external {
        _withAwarder(programId, waveId);
        _requireProgram(programId).points.awardCompliment(waveId, contributor, points, refHash);
    }

    function awardCommunity(
        uint256 programId,
        uint256 waveId,
        address contributor,
        uint256 points,
        bytes32 refHash
    ) external {
        _withAwarder(programId, waveId);
        _requireProgram(programId).points.awardCommunity(waveId, contributor, points, refHash);
    }

    // ── Distribution ─────────────────────────────────────────────────────

    function claim(uint256 programId, uint256 waveId)
        external
        nonReentrant
        returns (uint256 amount)
    {
        Storage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        if (w.programId != programId) revert WaveNotFound();
        if (!w.finalized) revert ZeroBudget();
        if ($.claimedFinalized[waveId][msg.sender]) revert AlreadyClaimed();

        uint256 share = claimableShare(programId, waveId, msg.sender);
        if (share == 0) revert ZeroBudget();

        uint256 netBudget = $.finalizedWaveBudget[waveId];
        // Dust guard: cap last claim so we never over-distribute beyond netBudget.
        uint256 outstanding = netBudget - w.totalDistributed;
        if (share > outstanding) share = outstanding;

        $.claimedFinalized[waveId][msg.sender] = true;
        w.totalDistributed += share;
        $.totalDistributed += share;

        IERC20(_requireProgram(programId).token).safeTransfer(msg.sender, share);
        emit WaveClaimed(programId, waveId, msg.sender, share);
        return share;
    }

    // ── Views ────────────────────────────────────────────────────────────

    function remainingPool(uint256 programId) public view returns (uint256) {
        Storage storage $ = _getStorage();
        _requireProgramRead(programId, $);
        uint256 r = $.totalReceived - $.totalDistributed;
        return r;
    }

    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256) {
        return _getStorage().waves[waveId].budget;
    }

    function totalClaimable(uint256 programId, uint256 waveId) public view returns (uint256) {
        Storage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        if (w.programId != programId || !w.finalized) return 0;
        return $.finalizedWaveBudget[waveId] - w.totalDistributed;
    }

    function claimableShare(uint256 programId, uint256 waveId, address who)
        public
        view
        returns (uint256)
    {
        Storage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        if (w.programId != programId || !w.finalized) return 0;
        if ($.claimedFinalized[waveId][who]) return 0;

        uint256 netBudget = $.finalizedWaveBudget[waveId];
        uint256 totalPts = _requireProgram(programId).points.totalPoints(waveId);
        if (totalPts == 0) return 0;
        uint256 pts = _requireProgram(programId).points.contributorPoints(waveId, who);
        return (netBudget * pts) / totalPts;
    }

    function claimed(uint256 programId, uint256 waveId, address who)
        external
        view
        returns (bool)
    {
        return _getStorage().claimedFinalized[waveId][who];
    }

    function program(uint256 programId) external view returns (Program memory) {
        return _requireProgram(programId);
    }

    function wave(uint256 waveId) external view returns (Wave memory) {
        return _getStorage().waves[waveId];
    }

    function pointsLedger(uint256 programId) external view returns (IPointsLedger) {
        return _requireProgram(programId).points;
    }

    function approveRepo(uint256 programId, bytes32 repoHash, bool allowed) external {
        _onlyOrganizerOrAwarder(programId);
        _getStorage().approvedRepos[programId][repoHash] = allowed;
        emit RepoApprovalChanged(programId, repoHash, allowed);
    }

    function approved(uint256 programId, bytes32 repoHash) external view returns (bool) {
        return _getStorage().approvedRepos[programId][repoHash];
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function _requireProgram(uint256 programId) internal view returns (Program storage p) {
        Storage storage $ = _getStorage();
        p = $.programs[programId];
        if (!p.initialized) revert ProgramNotFound();
    }

    function _requireProgramRead(uint256 programId, Storage storage $)
        internal
        view
        returns (Program storage p)
    {
        p = $.programs[programId];
        if (!p.initialized) revert ProgramNotFound();
    }

    function _requireProgramStorage(uint256 programId)
        internal
        view
        returns (Program storage p)
    {
        p = _requireProgram(programId);
    }

    function _onlyOrganizer(uint256 programId) internal view {
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
    }

    function _requireExpected(Wave storage w, uint256 programId, WaveStatus s)
        internal
        view
    {
        if (w.programId != programId) revert WaveNotFound();
        if (w.status != s) revert WrongStatus(s, w.status);
    }

    function _withAwarder(uint256 programId, uint256 waveId) internal view {
        _onlyOrganizerOrAwarder(programId);
        Wave storage w = _getStorage().waves[waveId];
        if (w.programId != programId) revert WaveNotFound();
        // Points may accrue during the build window (PR merges in Wave Issue) and
        // the evaluation window (judge scoring in Buildathon). They are only
        // immutable once the wave's evaluation closes (freezeWave). After that the
        // points ledger reverts all awards.
        if (w.status == WaveStatus.Closed || w.status == WaveStatus.None) {
            revert WrongStatus(WaveStatus.Evaluation, w.status);
        }
    }

    function _onlyOrganizerOrAwarder(uint256 programId) internal view {
        if (msg.sender == _requireProgram(programId).organizer) return;
        if (_getStorage().awarders[programId][msg.sender]) return;
        revert NotOrganizer();
    }

    // ── Timelocked pause / emergency withdraw (admin) ────────────────────
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function proposePause() external onlyOwner {
        _getStorage().pauseTimelock.propose(address(0xdead));
        emit PauseProposed(block.timestamp + TimelockManager.DELAY);
    }

    function executePause() external onlyOwner {
        _getStorage().pauseTimelock.execute();
        _pause();
    }

    function cancelPause() external onlyOwner {
        _getStorage().pauseTimelock.cancel();
    }

    function emergencyWithdraw(uint256 programId, uint256 amount) external onlyOwner nonReentrant {
        // Only undistributed, unfinalized pool can be pulled by admin on pause.
        Program memory p = _requireProgram(programId);
        IERC20(p.token).safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawn(programId, msg.sender, amount);
    }

    event PauseProposed(uint256 effectiveAt);
    event EmergencyWithdrawn(uint256 indexed programId, address indexed to, uint256 amount);
    event RepoApprovalChanged(uint256 indexed programId, bytes32 indexed repoHash, bool allowed);
}