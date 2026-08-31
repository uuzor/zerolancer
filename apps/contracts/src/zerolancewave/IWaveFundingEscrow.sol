// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IWaveFundingEscrow
/// @notice Funds-only vault for wave programs. No program/wave/project logic;
///         the verifier contract is the sole privileged caller.
interface IWaveFundingEscrow {
    error ZeroAddress();
    error NotVerifier();
    error ZeroAmount();
    error InsufficientPool();
    error NotOwner();

    event Deposited(uint256 indexed programId, address indexed from, uint256 amount);
    event Claimed(uint256 indexed programId, uint256 indexed waveId, address indexed to, uint256 amount);
    event EmergencyWithdrawn(uint256 indexed programId, address indexed to, uint256 amount);
    event WaveBudgetSet(uint256 indexed programId, uint256 indexed waveId, uint256 budget);
    event VerifierSet(address indexed verifier);
    event TreasurySet(address indexed treasury);

    function initialize(address admin, address treasury, address verifier) external;

    function deposit(uint256 programId, address token, uint256 amount) external;

    function claim(uint256 programId, uint256 waveId, address who, uint256 amount) external;

    function setWaveBudget(uint256 programId, uint256 waveId, uint256 budget) external;

    function emergencyWithdraw(uint256 programId, uint256 amount, address to) external;

    function pooled(uint256 programId) external view returns (uint256);
    function distributed(uint256 programId) external view returns (uint256);
    function waveBudgetOf(uint256 programId, uint256 waveId) external view returns (uint256);
    function programToken(uint256 programId) external view returns (address);
    function verifier() external view returns (address);
    function treasury() external view returns (address);
}