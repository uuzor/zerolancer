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
/// @notice Minimal escrow + wave-state verification layer. Holds USDC/0G tokens,
///         references wave programs, and releases funds only to verified recipients
///         after a wave is finalized. All business logic (budgets, points, projects)
///         lives off-chain in the backend.
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
        mapping(uint256 => Program) programs;
        mapping(uint256 => Wave) waves;
        mapping(uint256 => uint256) programOfWave;
        mapping(uint256 => mapping(address => bool)) claimedFinalized;
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

    // ── Claims (backend-driven) ──────────────────────────────────────────

    function claim(
        uint256 programId,
        uint256 waveId,
        address who,
        uint256 amount
    ) external nonReentrant returns (uint256) {
        if (who == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidParams();

        Wave storage w = _requireWave(waveId, programId);
        if (!w.finalized) revert ZeroBudget();

        Storage storage $ = _getStorage();
        if ($.claimedFinalized[waveId][who]) revert AlreadyClaimed();

        uint256 outstanding = remainingPool(programId);
        if (amount > outstanding) revert NotEnoughPool();

        $.claimedFinalized[waveId][who] = true;
        $.totalDistributed += amount;

        IERC20($.programs[programId].token).safeTransfer(who, amount);
        emit WaveClaimed(programId, waveId, who, amount);
        return amount;
    }

    // ── Views ────────────────────────────────────────────────────────────

    function remainingPool(uint256 programId) public view returns (uint256) {
        _requireProgram(programId);
        Storage storage $ = _getStorage();
        return $.totalReceived - $.totalDistributed;
    }

    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256) {
        _requireWave(waveId, programId);
        return 0; // backend-computed; contract only verifies wave exists
    }

    function totalClaimable(uint256 programId, uint256 waveId) external view returns (uint256) {
        _requireWave(waveId, programId);
        return remainingPool(programId);
    }

    function claimableShare(uint256 programId, uint256 waveId, address who) external view returns (uint256) {
        _requireWave(waveId, programId);
        if ($.claimedFinalized[waveId][who]) return 0;
        return 0; // backend-computed; contract only verifies eligibility
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
}
