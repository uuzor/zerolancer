// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IPointsLedger} from "./IPointsLedger.sol";
import {IWaveFundingEscrow} from "./IWaveFundingEscrow.sol";
import {IWaveFundingVerifier} from "./IWaveFundingVerifier.sol";

/// @title WaveFundingVerifier
/// @notice Program/wave/project state machine. No token custody. Calls into the
///         escrow contract for budget locks and claims.
contract WaveFundingVerifier is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IWaveFundingVerifier
{
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @custom:storage-location erc7201:zerolance.storage.WaveFundingVerifier
    struct VerifierStorage {
        IWaveFundingEscrow escrow;
        IPointsLedger pointsLedger;
        uint256 nextProgramId;
        uint256 nextWaveId;
        uint256 nextProjectId;
        mapping(uint256 => Program) programs;
        mapping(uint256 => Wave) waves;
        mapping(uint256 => uint256) programOfWave;
        mapping(uint256 => uint256) programWaveCount;
        mapping(uint256 => mapping(address => bool)) awarders;
        mapping(uint256 => Project) projects;
        mapping(uint256 => uint256[]) waveProjects;
        mapping(uint256 => uint256) projectOfIndex;
        mapping(uint256 => mapping(address => bool)) claimed;
        uint256[40] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x4d2e8f1c5b7a9d3e6f8b1c4d7e0a3f6b9c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f;

    function _getStorage() private pure returns (VerifierStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address escrow_, address pointsLedger_) external initializer {
        if (admin == address(0) || escrow_ == address(0) || pointsLedger_ == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        VerifierStorage storage $ = _getStorage();
        $.escrow = IWaveFundingEscrow(escrow_);
        $.pointsLedger = IPointsLedger(pointsLedger_);
    }

    function setPointsLedger(address ledger) external onlyOwner {
        if (ledger == address(0)) revert ZeroAddress();
        _getStorage().pointsLedger = IPointsLedger(ledger);
    }

    modifier onlyOrganizer(uint256 programId) {
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
        _;
    }

    // ── Program lifecycle ────────────────────────────────────────────────

    function createWaveProgram(
        address token,
        uint256 genesisPool,
        uint16 numWaves,
        uint64 buildWindow,
        uint64 evalWindow,
        uint64 complimentWindow,
        BudgetMethod budgetMethod,
        uint16 feeBps,
        address treasury,
        bytes32 specHash
    ) external whenNotPaused nonReentrant returns (uint256 programId) {
        if (token == address(0) || treasury == address(0)) revert ZeroAddress();
        if (numWaves == 0) revert InvalidNumWaves();
        if (feeBps > BPS_DENOMINATOR) revert InvalidBps();

        VerifierStorage storage $ = _getStorage();
        programId = $.nextProgramId++;

        $.programs[programId] = Program({
            organizer: msg.sender,
            token: token,
            genesisPool: genesisPool,
            numWaves: numWaves,
            buildWindow: buildWindow,
            evalWindow: evalWindow,
            complimentWindow: complimentWindow,
            budgetMethod: budgetMethod,
            feeBps: feeBps,
            treasury: treasury,
            specHash: specHash,
            initialized: true
        });

        if (genesisPool > 0) {
            $.escrow.deposit(programId, token, genesisPool);
        }

        emit ProgramCreated(
            programId,
            msg.sender,
            token,
            genesisPool,
            numWaves,
            budgetMethod,
            feeBps,
            treasury,
            specHash
        );
    }

    function depositPool(uint256 programId, uint256 amount) external nonReentrant whenNotPaused {
        Program memory p = _requireProgram(programId);
        if (amount == 0) revert ZeroBudget();
        _getStorage().escrow.deposit(programId, p.token, amount);
        emit PoolDeposited(programId, msg.sender, amount);
    }

    // ── Wave lifecycle ──────────────────────────────────────────────────

    function openWave(uint256 programId) external nonReentrant whenNotPaused returns (uint256 waveId) {
        Program storage p = _requireProgram(programId);
        if (msg.sender != p.organizer) revert NotOrganizer();
        VerifierStorage storage $ = _getStorage();
        uint256 seq = ++$.programWaveCount[programId];
        if (seq > p.numWaves) revert WaveSequenceExceeded();

        waveId = $.nextWaveId++;
        $.programOfWave[waveId] = programId;
        $.waves[waveId] = Wave({
            programId: programId,
            seq: seq,
            status: WaveStatus.Open,
            buildEndAt: block.timestamp + p.buildWindow,
            evalEndAt: 0
        });
        emit WaveOpened(programId, waveId, seq, block.timestamp + p.buildWindow);
    }

    function closeWave(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused {
        Wave storage w = _requireWave(waveId, programId);
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
        if (w.status != WaveStatus.Open) revert WrongWaveStatus(WaveStatus.Open, w.status);
        Program storage p = _getStorage().programs[programId];
        w.status = WaveStatus.Evaluation;
        w.evalEndAt = block.timestamp + p.evalWindow;
        emit WaveClosed(programId, waveId);
        emit EvaluationOpened(programId, waveId, w.evalEndAt);
    }

    function closeEvaluation(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused {
        Wave storage w = _requireWave(waveId, programId);
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
        if (w.status != WaveStatus.Evaluation) revert WrongWaveStatus(WaveStatus.Evaluation, w.status);
        Program storage p = _getStorage().programs[programId];
        if (p.complimentWindow == 0) {
            w.status = WaveStatus.Finalized;
            emit EvaluationClosed(programId, waveId);
            _finalizeWaveLocked(programId, waveId, p, w);
        } else {
            w.status = WaveStatus.Compliments;
            emit EvaluationClosed(programId, waveId);
        }
    }

    function finalizeWave(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused {
        Wave storage w = _requireWave(waveId, programId);
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
        if (w.status != WaveStatus.Compliments) revert WrongWaveStatus(WaveStatus.Compliments, w.status);
        Program storage p = _getStorage().programs[programId];
        w.status = WaveStatus.Finalized;
        _finalizeWaveLocked(programId, waveId, p, w);
    }

    function _finalizeWaveLocked(uint256 programId, uint256 waveId, Program storage p, Wave storage w) internal {
        VerifierStorage storage $ = _getStorage();
        uint256 budget;
        if (p.budgetMethod == BudgetMethod.FixedPerWave) {
            budget = p.genesisPool / p.numWaves;
        } else {
            uint256 remaining = _escrowAvailable(programId);
            uint256 wavesLeft = p.numWaves - w.seq + 1;
            budget = wavesLeft == 0 ? 0 : remaining / wavesLeft;
        }
        uint256 netBudget = (budget * (BPS_DENOMINATOR - p.feeBps)) / BPS_DENOMINATOR;
        $.escrow.setWaveBudget(programId, waveId, budget);
        $.pointsLedger.freezeWave(waveId);
        emit WaveFinalized(programId, waveId, budget, netBudget);
    }

    function closeProgram(uint256 programId) external nonReentrant whenNotPaused {
        Program memory p = _requireProgram(programId);
        if (msg.sender != p.organizer) revert NotOrganizer();
        VerifierStorage storage $ = _getStorage();
        if ($.programWaveCount[programId] != p.numWaves) revert WaveSequenceExceeded();
        uint256 available = _escrowAvailable(programId);
        if (available > 0) {
            $.escrow.emergencyWithdraw(programId, available, p.organizer);
        }
        emit ProgramClosed(programId, available);
    }

    // ── Awarders ─────────────────────────────────────────────────────────

    function grantAwarder(uint256 programId, address who, bool allowed) external {
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
        if (who == address(0)) revert ZeroAddress();
        _getStorage().awarders[programId][who] = allowed;
        emit AwarderSet(programId, who, allowed);
    }

    modifier onlyAwarder(uint256 programId) {
        VerifierStorage storage $ = _getStorage();
        Program memory p = _requireProgram(programId);
        if (msg.sender != p.organizer && !$.awarders[programId][msg.sender]) revert NotAwarder();
        _;
    }

    // ── Projects ─────────────────────────────────────────────────────────

    function registerProject(uint256 programId, uint256 waveId, address wallet, string calldata repoUrl)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 projectId)
    {
        Wave storage w = _requireWave(waveId, programId);
        if (w.status != WaveStatus.Open) revert WrongWaveStatus(WaveStatus.Open, w.status);
        if (wallet == address(0)) revert ZeroAddress();
        if (bytes(repoUrl).length == 0) revert InvalidParams();

        VerifierStorage storage $ = _getStorage();
        projectId = $.nextProjectId++;

        bytes32 repoHash = keccak256(bytes(repoUrl));
        $.projects[projectId] = Project({
            programId: programId,
            waveId: waveId,
            wallet: wallet,
            repoHash: repoHash,
            repoUrl: repoUrl,
            points: 0
        });
        $.waveProjects[waveId].push(projectId);
        $.projectOfIndex[projectId] = $.waveProjects[waveId].length - 1;

        emit ProjectRegistered(programId, waveId, projectId, wallet, repoUrl, repoHash);
    }

    function setProjectPoints(uint256 programId, uint256 projectId, uint256 points)
        external
        whenNotPaused
        onlyAwarder(programId)
    {
        VerifierStorage storage $ = _getStorage();
        Project storage p = $.projects[projectId];
        if (p.programId != programId) revert ProjectNotFound();
        Wave storage w = $.waves[p.waveId];
        if (w.status == WaveStatus.Finalized || w.status == WaveStatus.Closed) revert WaveNotFinalized();
        p.points = points;
        emit ProjectPointsSet(projectId, points);
    }

    // ── Award paths (operator-gated for mode contracts) ─────────────────

    function awardBase(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external {
        _getStorage().pointsLedger.awardBase(waveId, contributor, points, refHash);
    }

    function awardCompliment(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external {
        _getStorage().pointsLedger.awardCompliment(waveId, contributor, points, refHash);
    }

    function awardCommunity(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external {
        _getStorage().pointsLedger.awardCommunity(waveId, contributor, points, refHash);
    }

    // ── Claims ───────────────────────────────────────────────────────────

    function claim(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused returns (uint256 amount) {
        VerifierStorage storage $ = _getStorage();
        Wave storage w = _requireWave(waveId, programId);
        if (w.status != WaveStatus.Finalized) revert WaveNotFinalized();
        if ($.claimed[waveId][msg.sender]) revert AlreadyClaimed();

        uint256 total = $.pointsLedger.totalPoints(waveId);
        if (total == 0) revert ZeroBudget();
        uint256 mine = $.pointsLedger.contributorPoints(waveId, msg.sender);
        if (mine == 0) revert ZeroBudget();

        uint256 budget = $.escrow.waveBudgetOf(programId, waveId);
        amount = (budget * mine) / total;
        if (amount == 0) revert ZeroBudget();

        $.claimed[waveId][msg.sender] = true;
        $.escrow.claim(programId, waveId, msg.sender, amount);
        emit WaveClaimed(programId, waveId, msg.sender, amount);
    }

    // ── Views ────────────────────────────────────────────────────────────

    function program(uint256 programId) external view returns (Program memory) {
        return _requireProgram(programId);
    }

    function wave(uint256 waveId) external view returns (Wave memory) {
        uint256 programId = _getStorage().programOfWave[waveId];
        return _requireWave(waveId, programId);
    }

    function project(uint256 projectId) external view returns (Project memory) {
        Project memory p = _getStorage().projects[projectId];
        if (p.wallet == address(0)) revert ProjectNotFound();
        return p;
    }

    function waveProjects(uint256 programId, uint256 waveId) external view returns (uint256[] memory) {
        _requireWave(waveId, programId);
        return _getStorage().waveProjects[waveId];
    }

    function waveCount(uint256 programId) external view returns (uint256) {
        return _getStorage().programWaveCount[programId];
    }

    function pointsLedger() external view returns (address) {
        return address(_getStorage().pointsLedger);
    }

    function escrow() external view returns (address) {
        return address(_getStorage().escrow);
    }

    function remainingPool(uint256 programId) public view returns (uint256) {
        return _escrowAvailable(programId);
    }

    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256) {
        return _getStorage().escrow.waveBudgetOf(programId, waveId);
    }

    function totalClaimable(uint256 programId, uint256 waveId) external view returns (uint256) {
        return _getStorage().escrow.waveBudgetOf(programId, waveId);
    }

    function claimableShare(uint256 programId, uint256 waveId, address who) external view returns (uint256) {
        VerifierStorage storage $ = _getStorage();
        Wave storage w = _requireWave(waveId, programId);
        if (w.status != WaveStatus.Finalized) return 0;
        if ($.claimed[waveId][who]) return 0;
        uint256 total = $.pointsLedger.totalPoints(waveId);
        if (total == 0) return 0;
        uint256 mine = $.pointsLedger.contributorPoints(waveId, who);
        if (mine == 0) return 0;
        uint256 budget = $.escrow.waveBudgetOf(programId, waveId);
        return (budget * mine) / total;
    }

    function claimed(uint256 programId, uint256 waveId, address who) external view returns (bool) {
        _requireWave(waveId, programId);
        return _getStorage().claimed[waveId][who];
    }

    function currentOpenWave(uint256 programId) external view returns (uint256) {
        VerifierStorage storage $ = _getStorage();
        uint256 count = $.programWaveCount[programId];
        for (uint256 i = 0; i < count; i++) {
            uint256 waveId = _openWaveAt(programId, i + 1);
            if (waveId != 0 && $.waves[waveId].status == WaveStatus.Open) {
                return waveId;
            }
        }
        return 0;
    }

    function _openWaveAt(uint256 programId, uint256 seq) internal view returns (uint256) {
        VerifierStorage storage $ = _getStorage();
        for (uint256 i = 0; i < $.nextWaveId; i++) {
            if ($.waves[i].programId == programId && $.waves[i].seq == seq) return i;
        }
        return 0;
    }

    function _escrowAvailable(uint256 programId) internal view returns (uint256) {
        IWaveFundingEscrow e = _getStorage().escrow;
        return e.pooled(programId) - e.distributed(programId);
    }

    function _requireProgram(uint256 programId) internal view returns (Program storage p) {
        p = _getStorage().programs[programId];
        if (!p.initialized) revert ProgramNotFound();
    }

    function _requireWave(uint256 waveId, uint256 programId) internal view returns (Wave storage w) {
        VerifierStorage storage $ = _getStorage();
        w = $.waves[waveId];
        if (w.programId != programId || w.status == WaveStatus.None) revert WaveNotFound();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}