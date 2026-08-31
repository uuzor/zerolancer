// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IZeroLanceWaveProgram} from "./IZeroLanceWaveProgram.sol";

/// @title ZeroLanceWaveProgram
/// @notice Escrow + verification layer for wave programs. Holds USDC, tracks
///         wave state, records project points (backend-computed), and distributes
///         to builder wallets proportional to their project points in finalized waves.
contract ZeroLanceWaveProgram is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveProgram
{
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct Storage {
        uint256 totalReceived;
        uint256 totalDistributed;
        uint256 nextProgramId;
        uint256 nextWaveId;
        uint256 nextProjectId;
        mapping(uint256 => Program) programs;
        mapping(uint256 => Wave) waves;
        mapping(uint256 => uint256) programOfWave;
        mapping(uint256 => mapping(address => bool)) claimedFinalized;
        mapping(uint256 => Project) projects; // projectId -> project
        mapping(uint256 => uint256) projectWave; // projectId -> waveId
        mapping(uint256 => uint256) waveTotalPoints; // waveId -> sum of all project points
        mapping(uint256 => mapping(address => uint256)) builderWavePoints; // waveId -> builder -> points
        uint256[50] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xe7d1ce599715f2d0254dff207ad59daf0b3a2d1818ac635ef3effc283b015936;

    function _getStorage() private pure returns (Storage storage $) {
        assembly { $.slot := STORAGE_LOCATION }
    }

    constructor() { _disableInitializers(); }

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
        uint16 feeBps,
        address treasury
    ) external nonReentrant returns (uint256 programId) {
        if (token == address(0) || treasury == address(0)) revert ZeroAddress();
        if (genesisPool_ == 0 || feeBps > BPS_DENOMINATOR) revert InvalidParams();

        Storage storage $ = _getStorage();
        programId = $.nextProgramId++;

        $.programs[programId] = Program({
            token: token,
            organizer: msg.sender,
            treasury: treasury,
            feeBps: feeBps,
            initialized: true
        });

        if (genesisPool_ > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), genesisPool_);
            $.totalReceived += genesisPool_;
        }

        emit ProgramCreated(programId, msg.sender);
    }

    function depositPool(uint256 programId, uint256 amount) external nonReentrant {
        _requireProgram(programId);
        if (amount == 0) revert InvalidParams();
        IERC20($.programs[programId].token).safeTransferFrom(msg.sender, address(this), amount);
        $.totalReceived += amount;
        emit PoolDeposited(programId, msg.sender, amount);
    }

    // ── Wave lifecycle (verification only) ──────────────────────────────

    function openWave(uint256 programId) external nonReentrant returns (uint256 waveId) {
        _onlyOrganizer(programId);
        Storage storage $ = _getStorage();
        waveId = $.nextWaveId++;
        $.programOfWave[waveId] = programId;
        $.waves[waveId] = Wave({
            programId: programId,
            status: WaveStatus.Open,
            finalized: false
        });
        emit WaveOpened(programId, waveId, 0);
    }

    function closeWave(uint256 programId, uint256 waveId) external {
        _onlyOrganizer(programId);
        Wave storage w = _requireWave(waveId, programId);
        w.status = WaveStatus.Evaluation;
        emit WaveClosed(programId, waveId);
        emit EvaluationOpened(programId, waveId, 0);
    }

    function finalizeWave(uint256 programId, uint256 waveId) external nonReentrant {
        _onlyOrganizer(programId);
        Wave storage w = _requireWave(waveId, programId);
        if (w.status == WaveStatus.None) revert WaveNotFound();
        w.status = WaveStatus.Finalized;
        w.finalized = true;
        emit WaveFinalized(programId, waveId, 0);
    }

    // ── Project registration (backend-driven) ────────────────────────────

    function registerProject(
        uint256 programId,
        uint256 waveId,
        address builder,
        bytes32 repoHash
    ) external nonReentrant returns (uint256 projectId) {
        _onlyOrganizer(programId);
        _requireWave(waveId, programId);
        if (builder == address(0)) revert ZeroAddress();

        Storage storage $ = _getStorage();
        projectId = $.nextProjectId++;

        $.projects[projectId] = Project({
            programId: programId,
            waveId: waveId,
            builder: builder,
            repoHash: repoHash,
            points: 0,
            claimed: false
        });
        $.projectWave[projectId] = waveId;

        emit ProjectRegistered(programId, waveId, projectId, builder, repoHash);
    }

    function setProjectPoints(uint256 projectId, uint256 points) external {
        _onlyOrganizer($.projects[projectId].programId);
        Project storage p = $.projects[projectId];
        if (p.builder == address(0)) revert ProjectNotFound();

        uint256 oldPoints = p.points;
        p.points = points;

        // Update wave total and builder totals
        uint256 waveId = $.projectWave[projectId];
        $.waveTotalPoints[waveId] += points - oldPoints;
        $.builderWavePoints[waveId][p.builder] += points - oldPoints;

        emit ProjectPointsSet(projectId, points);
    }

    // ── Claims (points-based distribution) ──────────────────────────────

    function claim(uint256 programId, uint256 waveId, address who) external nonReentrant returns (uint256) {
        if (who == address(0)) revert ZeroAddress();

        Wave storage w = _requireWave(waveId, programId);
        if (!w.finalized) revert ZeroBudget();

        Storage storage $ = _getStorage();
        if ($.claimedFinalized[waveId][who]) revert AlreadyClaimed();

        uint256 totalPoints = $.waveTotalPoints[waveId];
        if (totalPoints == 0) revert ZeroBudget();

        uint256 builderPoints = $.builderWavePoints[waveId][who];
        if (builderPoints == 0) revert ZeroBudget();

        // Find all projects for this builder in this wave and mark claimed
        uint256 totalClaimed = 0;
        for (uint256 pid = 0; pid < $.nextProjectId; pid++) {
            Project storage p = $.projects[pid];
            if (p.programId == programId && p.waveId == waveId && p.builder == who && !p.claimed) {
                p.claimed = true;
                totalClaimed += p.points;
            }
        }

        if (totalClaimed == 0) revert ZeroBudget();

        uint256 waveBudget = remainingPool(programId);
        uint256 share = (waveBudget * totalClaimed) / totalPoints;
        if (share == 0) revert ZeroBudget();

        $.claimedFinalized[waveId][who] = true;
        $.totalDistributed += share;

        IERC20($.programs[programId].token).safeTransfer(who, share);
        emit WaveClaimed(programId, waveId, who, share);
        return share;
    }

    // ── Views ────────────────────────────────────────────────────────────

    function remainingPool(uint256 programId) public view returns (uint256) {
        _requireProgram(programId);
        Storage storage $ = _getStorage();
        return $.totalReceived - $.totalDistributed;
    }

    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256) {
        _requireWave(waveId, programId);
        return remainingPool(programId);
    }

    function totalClaimable(uint256 programId, uint256 waveId) external view returns (uint256) {
        _requireWave(waveId, programId);
        return remainingPool(programId);
    }

    function claimableShare(uint256 programId, uint256 waveId, address who) external view returns (uint256) {
        _requireWave(waveId, programId);
        Storage storage $ = _getStorage();
        if ($.claimedFinalized[waveId][who]) return 0;
        uint256 totalPoints = $.waveTotalPoints[waveId];
        if (totalPoints == 0) return 0;
        uint256 builderPoints = $.builderWavePoints[waveId][who];
        if (builderPoints == 0) return 0;
        uint256 waveBudget = remainingPool(programId);
        return (waveBudget * builderPoints) / totalPoints;
    }

    function claimed(uint256 programId, uint256 waveId, address who) external view returns (bool) {
        _requireWave(waveId, programId);
        return $.claimedFinalized[waveId][who];
    }

    function program(uint256 programId) external view returns (Program memory) {
        return _requireProgram(programId);
    }

    function wave(uint256 waveId) external view returns (Wave memory) {
        _requireWave(waveId, $.programOfWave[waveId]);
        return $.waves[waveId];
    }

    function project(uint256 projectId) external view returns (Project memory) {
        Storage storage $ = _getStorage();
        Project memory p = $.projects[projectId];
        if (p.builder == address(0)) revert ProjectNotFound();
        return p;
    }

    function waveProjects(uint256 programId, uint256 waveId) external view returns (Project[] memory) {
        _requireWave(waveId, programId);
        Storage storage $ = _getStorage();
        uint256 count = 0;
        for (uint256 i = 0; i < $.nextProjectId; i++) {
            if ($.projects[i].programId == programId && $.projects[i].waveId == waveId) {
                count++;
            }
        }
        Project[] memory result = new Project[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < $.nextProjectId; i++) {
            if ($.projects[i].programId == programId && $.projects[i].waveId == waveId) {
                result[idx++] = $.projects[i];
            }
        }
        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function _requireProgram(uint256 programId) internal view returns (Program storage p) {
        Storage storage $ = _getStorage();
        p = $.programs[programId];
        if (!p.initialized) revert ProgramNotFound();
    }

    function _requireWave(uint256 waveId, uint256 programId) internal view returns (Wave storage w) {
        Storage storage $ = _getStorage();
        w = $.waves[waveId];
        if (w.programId != programId || w.status == WaveStatus.None) revert WaveNotFound();
    }

    function _onlyOrganizer(uint256 programId) internal view {
        if (msg.sender != _requireProgram(programId).organizer) revert NotOrganizer();
    }

    // ── Admin safety ─────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function emergencyWithdraw(uint256 programId, uint256 amount) external onlyOwner nonReentrant {
        Program memory p = _requireProgram(programId);
        IERC20(p.token).safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawn(programId, msg.sender, amount);
    }

    event PauseProposed(uint256 effectiveAt);
    event EmergencyWithdrawn(uint256 indexed programId, address indexed to, uint256 amount);
    event ProjectRegistered(uint256 indexed programId, uint256 indexed waveId, uint256 indexed projectId, address indexed builder, bytes32 repoHash);
    event ProjectPointsSet(uint256 indexed projectId, uint256 points);
}
