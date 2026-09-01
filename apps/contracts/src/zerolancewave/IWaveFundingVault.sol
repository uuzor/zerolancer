// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IWaveFundingVault
/// @notice Unified wave escrow for OSS and buildathon programs.
/// @dev Funds are held in USDC (or other ERC-20) and distributed pro-rata
///      based on points awarded by the backend signer.
interface IWaveFundingVault {
    enum WaveStatus { None, Open, Evaluation, Finalized, Closed }
    enum BudgetMethod { FixedPerWave, PctOfRemaining }

    struct Program {
        address token;
        address organizer;
        address treasury;
        uint16 feeBps;
        uint256 totalReceived;
        uint256 totalDistributed;
        bool initialized;
        BudgetMethod budgetMethod;
        uint256 genesisPool;
        uint16 numWaves;
        bytes32 specHash;
    }

    struct Wave {
        uint256 programId;
        uint64 waveSeq;
        uint64 buildEndAt;
        uint64 evalEndAt;
        WaveStatus status;
        uint256 budget;
        bool finalized;
    }

    error ZeroAddress();
    error InvalidParams();
    error ProgramNotFound();
    error NotOrganizer();
    error WaveNotFound();
    error WrongStatus();
    error ZeroBudget();
    error AlreadyClaimed();
    error NotSigner();
    error InsufficientPool();

    event ProgramCreated(
        uint256 indexed programId,
        address indexed organizer,
        address token,
        uint256 genesisPool,
        uint16 numWaves,
        uint16 feeBps,
        address treasury,
        bytes32 specHash
    );
    event PoolDeposited(uint256 indexed programId, address indexed from, uint256 amount);
    event WaveOpened(uint256 indexed programId, uint256 indexed waveId, uint64 waveSeq);
    event WaveClosed(uint256 indexed programId, uint256 indexed waveId);
    event WaveFinalized(uint256 indexed programId, uint256 indexed waveId, uint256 budget);
    event PointsSet(uint256 indexed waveId, address indexed builder, uint256 points);
    event WaveClaimed(uint256 indexed programId, uint256 indexed waveId, address indexed builder, uint256 share);
    event EmergencyWithdrawn(uint256 indexed programId, address indexed to, uint256 amount);

    function initialize(address admin, address treasury, address signer) external;

    function createProgram(
        address token,
        uint256 genesisPool,
        uint16 numWaves,
        uint16 feeBps,
        address treasury,
        bytes32 specHash
    ) external returns (uint256 programId);

    function deposit(uint256 programId, uint256 amount) external;

    function openWave(uint256 programId) external returns (uint256 waveId);

    function closeWave(uint256 programId, uint256 waveId) external;

    function finalizeWave(uint256 programId, uint256 waveId) external;

    function setPoints(uint256 waveId, address builder, uint256 points) external;

    function claim(uint256 waveId, address builder) external;

    function emergencyWithdraw(uint256 programId, address to, uint256 amount) external;

    function program(uint256 programId) external view returns (Program memory);

    function wave(uint256 waveId) external view returns (Wave memory);

    function waveCount(uint256 programId) external view returns (uint256);

    function builderPoints(uint256 waveId, address builder) external view returns (uint256);

    function totalWavePoints(uint256 waveId) external view returns (uint256);

    function claimableShare(uint256 programId, uint256 waveId, address builder) external view returns (uint256);

    function pooled(uint256 programId) external view returns (uint256);

    function distributed(uint256 programId) external view returns (uint256);

    function treasury() external view returns (address);

    function signer() external view returns (address);
}
