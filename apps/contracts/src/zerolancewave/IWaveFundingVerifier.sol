// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPointsLedger} from "./IPointsLedger.sol";

/// @title IWaveFundingVerifier
/// @notice Owns program, wave, project, awarder, and points state. Calls into
///         the escrow for budget locks and claims. No token custody.
interface IWaveFundingVerifier {
    enum BudgetMethod {
        FixedPerWave,
        PctOfRemaining
    }

    enum WaveStatus {
        None,
        Open,
        Evaluation,
        Compliments,
        Finalized,
        Closed
    }

    struct Program {
        address organizer;
        address token;
        uint256 genesisPool;
        uint16 numWaves;
        uint64 buildWindow;
        uint64 evalWindow;
        uint64 complimentWindow;
        BudgetMethod budgetMethod;
        uint16 feeBps;
        address treasury;
        bytes32 specHash;
        bool initialized;
    }

    struct Wave {
        uint256 programId;
        uint256 seq;
        WaveStatus status;
        uint256 buildEndAt;
        uint256 evalEndAt;
    }

    struct Project {
        uint256 programId;
        uint256 waveId;
        address wallet;
        bytes32 repoHash;
        string repoUrl;
        uint256 points;
    }

    event ProgramCreated(
        uint256 indexed programId,
        address indexed organizer,
        address token,
        uint256 genesisPool,
        uint16 numWaves,
        BudgetMethod budgetMethod,
        uint16 feeBps,
        address treasury,
        bytes32 specHash
    );
    event PoolDeposited(uint256 indexed programId, address indexed from, uint256 amount);
    event WaveOpened(uint256 indexed programId, uint256 indexed waveId, uint256 seq, uint256 buildEndAt);
    event WaveClosed(uint256 indexed programId, uint256 indexed waveId);
    event EvaluationOpened(uint256 indexed programId, uint256 indexed waveId, uint256 evalEndAt);
    event EvaluationClosed(uint256 indexed programId, uint256 indexed waveId);
    event WaveFinalized(uint256 indexed programId, uint256 indexed waveId, uint256 budget, uint256 netBudget);
    event ProgramClosed(uint256 indexed programId, uint256 returned);
    event ProjectRegistered(
        uint256 indexed programId,
        uint256 indexed waveId,
        uint256 indexed projectId,
        address wallet,
        string repoUrl,
        bytes32 repoHash
    );
    event ProjectPointsSet(uint256 indexed projectId, uint256 points);
    event AwarderSet(uint256 indexed programId, address indexed awarder, bool allowed);
    event WaveClaimed(
        uint256 indexed programId,
        uint256 indexed waveId,
        address indexed contributor,
        uint256 amount
    );

    error ZeroAddress();
    error InvalidParams();
    error InvalidBps();
    error InvalidNumWaves();
    error ProgramNotFound();
    error WaveNotFound();
    error ProjectNotFound();
    error NotOrganizer();
    error NotAwarder();
    error WrongWaveStatus(WaveStatus expected, WaveStatus actual);
    error WaveSequenceExceeded();
    error WaveNotFinalized();
    error NotPointsLedgerOperator();
    error ZeroBudget();
    error AlreadyClaimed();
    error NotProjectOwner();

    function initialize(address admin, address escrow, address pointsLedger) external;

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
    ) external returns (uint256 programId);

    function depositPool(uint256 programId, uint256 amount) external;

    function openWave(uint256 programId) external returns (uint256 waveId);
    function closeWave(uint256 programId, uint256 waveId) external;
    function closeEvaluation(uint256 programId, uint256 waveId) external;
    function finalizeWave(uint256 programId, uint256 waveId) external;
    function closeProgram(uint256 programId) external;

    function grantAwarder(uint256 programId, address who, bool allowed) external;

    function registerProject(uint256 programId, uint256 waveId, address wallet, string calldata repoUrl)
        external
        returns (uint256 projectId);

    function setProjectPoints(uint256 programId, uint256 projectId, uint256 points) external;

    function awardBase(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external;
    function awardCompliment(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external;
    function awardCommunity(uint256 waveId, address contributor, uint256 points, bytes32 refHash) external;

    function claim(uint256 programId, uint256 waveId) external returns (uint256 amount);

    function program(uint256 programId) external view returns (Program memory);
    function wave(uint256 waveId) external view returns (Wave memory);
    function project(uint256 projectId) external view returns (Project memory);
    function waveProjects(uint256 programId, uint256 waveId) external view returns (uint256[] memory);
    function waveCount(uint256 programId) external view returns (uint256);
    function pointsLedger() external view returns (address);
    function escrow() external view returns (address);
    function remainingPool(uint256 programId) external view returns (uint256);
    function waveBudget(uint256 programId, uint256 waveId) external view returns (uint256);
    function totalClaimable(uint256 programId, uint256 waveId) external view returns (uint256);
    function claimableShare(uint256 programId, uint256 waveId, address who) external view returns (uint256);
    function claimed(uint256 programId, uint256 waveId, address who) external view returns (bool);
    function currentOpenWave(uint256 programId) external view returns (uint256);
}