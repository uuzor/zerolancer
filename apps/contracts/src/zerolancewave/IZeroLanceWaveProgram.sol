// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPointsLedger} from "./IPointsLedger.sol";

/// @title IZeroLanceWaveProgram
/// @notice Shared Wave funding program supporting two modes (Wave Issue + Wave
///         Buildathon). A program holds a reward pool (USDC/0G), defines a
///         sequence of waves, and distributes each wave's budget proportionally
///         to points earned (claimable).
interface IZeroLanceWaveProgram {
    enum BudgetMethod {
        FixedPerWave,
        PctOfRemaining
    }

    /// @notice Lifecycle of a single wave inside a program.
    ///         timeline: openWave (build starts) -> closeWave (end build)
    ///         -> openEvaluation (points/judging only) -> closeEvaluation (points frozen)
    ///         -> finalizeWave (budget computed) -> claim (contributors claim shares).
    enum WaveStatus {
        None,
        Open,
        Evaluation,
        Finalized,
        Closed
    }

    struct Program {
        address token; // settlement token (USDC/MockUSDC or 0G)
        address organizer;
        uint256 genesisPool; // initial funded amount (deducted from organizer)
        uint256 numWaves;
        uint256 buildWindow; // seconds
        uint256 evalWindow; // seconds (points/judging)
        uint256 complimentWindow; // seconds (bonus points, optional)
        BudgetMethod budgetMethod;
        uint16 feeBps; // platform fee on distributed amounts
        address treasury; // fee receiver
        IPointsLedger points; // shared points ledger
        uint256 currentWave; // last opened wave id (global wave id)
        uint256 waveSeq; // number of waves opened so far in this program
        bool initialized;
    }

    struct Wave {
        uint256 programId;
        WaveStatus status;
        uint256 buildEndAt;
        uint256 evalEndAt;
        uint256 complimentEndAt;
        uint256 budget; // fixed when finalizeWave runs
        uint256 totalDistributed; // tokens claimed so far
        bool finalized;
    }

    event ProgramCreated(uint256 indexed programId, address indexed organizer);
    event PoolDeposited(uint256 indexed programId, address indexed funder, uint256 amount);
    event WaveOpened(uint256 indexed programId, uint256 indexed waveId, uint256 buildEndAt);
    event WaveClosed(uint256 indexed programId, uint256 indexed waveId);
    event EvaluationOpened(uint256 indexed programId, uint256 indexed waveId, uint256 evalEndAt);
    event EvaluationClosed(uint256 indexed programId, uint256 indexed waveId);
    event WaveFinalized(uint256 indexed programId, uint256 indexed waveId, uint256 budget);
    event WaveClaimed(
        uint256 indexed programId,
        uint256 indexed waveId,
        address indexed contributor,
        uint256 amount
    );

    error ZeroAddress();
    error InvalidParams();
    error ProgramNotFound();
    error NotOrganizer();
    error WaveNotFound();
    error WrongStatus(WaveStatus expected, WaveStatus actual);
    error NotEnoughPool();
    error ZeroBudget();
    error AlreadyClaimed();
    error NotInitialized();

    function createWaveProgram(
        address token,
        uint256 genesisPool,
        uint256 numWaves,
        uint256 buildWindow,
        uint256 evalWindow,
        uint256 complimentWindow,
        BudgetMethod budgetMethod,
        uint16 feeBps,
        address treasury,
        bytes32 specHash
    ) external returns (uint256 programId);

    function depositPool(uint256 programId, uint256 amount) external;

    function openWave(uint256 programId) external returns (uint256 waveId);

    function closeWave(uint256 programId, uint256 waveId) external;

    function openEvaluation(uint256 programId, uint256 waveId) external;

    function closeEvaluation(uint256 programId, uint256 waveId) external;

    function finalizeWave(uint256 programId, uint256 waveId) external;

    /// @notice Claim a contributor's share of a finalized wave's budget.
    /// @return amount The tokens paid out (share - platform fee).
    function claim(uint256 programId, uint256 waveId) external returns (uint256 amount);

    function remainingPool(uint256 programId) external view returns (uint256);

    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256);

    function totalClaimable(uint256 programId, uint256 waveId)
        external
        view
        returns (uint256);

    function claimableShare(uint256 programId, uint256 waveId, address who)
        external
        view
        returns (uint256);

    function claimed(uint256 programId, uint256 waveId, address who)
        external
        view
        returns (bool);
}