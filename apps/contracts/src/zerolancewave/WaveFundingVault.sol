// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IWaveFundingVault} from "./IWaveFundingVault.sol";

using SafeERC20 for IERC20;

/// @title WaveFundingVault
/// @notice Unified wave escrow for OSS and buildathon programs.
/// @dev UUPS upgradeable. ERC-7201 namespaced storage.
contract WaveFundingVault is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IWaveFundingVault
{
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @custom:storage-location erc7201:zerolance.storage.WaveFundingVault
    struct VaultStorage {
        address treasury;
        address signer;
        uint256 nextProgramId;
        uint256 nextWaveId;
        mapping(uint256 => Program) programs;
        mapping(uint256 => Wave) waves;
        mapping(uint256 => uint256) programOfWave;
        mapping(uint256 => uint256) programWaveCount;
        mapping(uint256 => mapping(address => uint256)) builderPoints;
        mapping(uint256 => uint256) totalWavePoints;
        mapping(uint256 => mapping(address => bool)) claimed;
        mapping(uint256 => uint256) pooled;
        mapping(uint256 => uint256) distributed;
        uint256[43] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2;

    function _getStorage() private pure returns (VaultStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address treasury_, address signer_) external initializer {
        if (admin == address(0) || treasury_ == address(0) || signer_ == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        VaultStorage storage $ = _getStorage();
        $.treasury = treasury_;
        $.signer = signer_;
        $.nextProgramId = 1;
        $.nextWaveId = 1;
    }

    function createProgram(
        address token,
        uint256 genesisPool,
        uint16 numWaves,
        uint16 feeBps,
        address treasury_,
        bytes32 specHash
    ) external nonReentrant whenNotPaused returns (uint256 programId) {
        if (token == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (genesisPool == 0 || numWaves == 0) revert InvalidParams();
        if (feeBps > BPS_DENOMINATOR) revert InvalidParams();

        IERC20(token).safeTransferFrom(msg.sender, address(this), genesisPool);

        VaultStorage storage $ = _getStorage();
        programId = $.nextProgramId++;
        Program storage p = $.programs[programId];
        p.token = token;
        p.organizer = msg.sender;
        p.treasury = treasury_;
        p.feeBps = feeBps;
        p.totalReceived = genesisPool;
        p.initialized = true;
        p.budgetMethod = BudgetMethod.FixedPerWave;
        p.genesisPool = genesisPool;
        p.numWaves = numWaves;
        p.specHash = specHash;

        $.pooled[programId] = genesisPool;

        emit ProgramCreated(programId, msg.sender, token, genesisPool, numWaves, feeBps, treasury_, specHash);
    }

    function deposit(uint256 programId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidParams();
        VaultStorage storage $ = _getStorage();
        Program storage p = $.programs[programId];
        if (!p.initialized) revert ProgramNotFound();

        IERC20(p.token).safeTransferFrom(msg.sender, address(this), amount);
        $.pooled[programId] += amount;
        p.totalReceived += amount;

        emit PoolDeposited(programId, msg.sender, amount);
    }

    function openWave(uint256 programId) external nonReentrant whenNotPaused returns (uint256 waveId) {
        VaultStorage storage $ = _getStorage();
        Program storage p = $.programs[programId];
        if (!p.initialized) revert ProgramNotFound();
        if (msg.sender != p.organizer) revert NotOrganizer();

        uint64 seq = uint64(++$.programWaveCount[programId]);
        if (seq > p.numWaves) revert WrongStatus();

        waveId = $.nextWaveId++;
        $.programOfWave[waveId] = programId;

        Wave storage w = $.waves[waveId];
        w.programId = programId;
        w.waveSeq = seq;
        w.buildEndAt = uint64(block.timestamp);
        w.status = WaveStatus.Open;

        emit WaveOpened(programId, waveId, seq);
    }

    function closeWave(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused {
        VaultStorage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        if (w.programId != programId) revert WaveNotFound();
        if (msg.sender != $.programs[programId].organizer) revert NotOrganizer();
        if (w.status != WaveStatus.Open) revert WrongStatus();

        w.status = WaveStatus.Evaluation;
        w.evalEndAt = uint64(block.timestamp);

        emit WaveClosed(programId, waveId);
    }

    function finalizeWave(uint256 programId, uint256 waveId) external nonReentrant whenNotPaused {
        VaultStorage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        Program storage p = $.programs[programId];
        if (w.programId != programId) revert WaveNotFound();
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (w.status != WaveStatus.Evaluation) revert WrongStatus();

        uint256 budget;
        uint256 remaining = p.numWaves - w.waveSeq + 1;
        if (p.budgetMethod == BudgetMethod.FixedPerWave) {
            budget = p.genesisPool / p.numWaves;
        } else {
            budget = ($.pooled[programId] - $.distributed[programId]) / remaining;
        }

        w.budget = budget;
        w.status = WaveStatus.Finalized;
        w.finalized = true;

        emit WaveFinalized(programId, waveId, budget);
    }

    function setPoints(uint256 waveId, address builder, uint256 points) external nonReentrant whenNotPaused {
        VaultStorage storage $ = _getStorage();
        if (msg.sender != $.signer) revert NotSigner();

        Wave storage w = $.waves[waveId];
        if (w.programId == 0) revert WaveNotFound();
        if (w.status == WaveStatus.Finalized) revert WrongStatus();

        uint256 old = $.builderPoints[waveId][builder];
        $.builderPoints[waveId][builder] = points;
        $.totalWavePoints[waveId] += points - old;

        emit PointsSet(waveId, builder, points);
    }

    function claim(uint256 waveId, address builder) external nonReentrant whenNotPaused {
        VaultStorage storage $ = _getStorage();
        Wave storage w = $.waves[waveId];
        if (w.programId == 0) revert WaveNotFound();
        if (w.status != WaveStatus.Finalized) revert WrongStatus();

        uint256 totalPoints = $.totalWavePoints[waveId];
        uint256 bp = $.builderPoints[waveId][builder];
        if (totalPoints == 0 || bp == 0) revert ZeroBudget();
        if ($.claimed[waveId][builder]) revert AlreadyClaimed();

        uint256 netBudget = (w.budget * (BPS_DENOMINATOR - $.programs[w.programId].feeBps)) / BPS_DENOMINATOR;
        uint256 share = (netBudget * bp) / totalPoints;
        if (share == 0) revert ZeroBudget();

        $.claimed[waveId][builder] = true;
        $.distributed[w.programId] += share;

        IERC20($.programs[w.programId].token).safeTransfer(builder, share);

        emit WaveClaimed(w.programId, waveId, builder, share);
    }

    function emergencyWithdraw(uint256 programId, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        VaultStorage storage $ = _getStorage();
        uint256 available = $.pooled[programId] - $.distributed[programId];
        if (amount > available) revert InsufficientPool();

        $.distributed[programId] += amount;
        IERC20($.programs[programId].token).safeTransfer(to, amount);

        emit EmergencyWithdrawn(programId, to, amount);
    }

    function program(uint256 programId) external view returns (Program memory) {
        return _getStorage().programs[programId];
    }

    function wave(uint256 waveId) external view returns (Wave memory) {
        return _getStorage().waves[waveId];
    }

    function waveCount(uint256 programId) external view returns (uint256) {
        return _getStorage().programWaveCount[programId];
    }

    function builderPoints(uint256 waveId, address builder) external view returns (uint256) {
        return _getStorage().builderPoints[waveId][builder];
    }

    function totalWavePoints(uint256 waveId) external view returns (uint256) {
        return _getStorage().totalWavePoints[waveId];
    }

    function claimableShare(uint256 programId, uint256 waveId, address builder) external view returns (uint256) {
        VaultStorage storage $ = _getStorage();
        Wave memory w = $.waves[waveId];
        if (w.programId != programId || w.status != WaveStatus.Finalized) return 0;
        uint256 totalPoints = $.totalWavePoints[waveId];
        uint256 bp = $.builderPoints[waveId][builder];
        if (totalPoints == 0 || bp == 0) return 0;
        uint256 netBudget = (w.budget * (BPS_DENOMINATOR - $.programs[programId].feeBps)) / BPS_DENOMINATOR;
        return (netBudget * bp) / totalPoints;
    }

    function pooled(uint256 programId) external view returns (uint256) {
        return _getStorage().pooled[programId];
    }

    function distributed(uint256 programId) external view returns (uint256) {
        return _getStorage().distributed[programId];
    }

    function treasury() external view returns (address) {
        return _getStorage().treasury;
    }

    function signer() external view returns (address) {
        return _getStorage().signer;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
