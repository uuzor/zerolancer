// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceTaskEscrow
/// @notice Funds-only escrow for tasks. The verifier contract (ZeroLanceTaskVerifier)
///         is the only privileged caller for `release` and `resolveDispute`.
interface IZeroLanceTaskEscrow {
    error ZeroAddress();
    error ZeroAmount();
    error NotClient();
    error NotVerifier();
    error NotArbitration();
    error WrongStatus();
    error InsufficientEscrow();
    error AlreadyReleased();
    error InvalidBps();

    event Deposited(uint256 indexed taskId, address indexed client, uint256 amount);
    event Released(uint256 indexed taskId, address indexed freelancer, uint256 amount, uint256 fee);
    event Refunded(uint256 indexed taskId, address indexed client, uint256 amount);
    event Resolved(uint256 indexed taskId, address indexed winner, uint256 amount);
    event TaskRegistrySet(address indexed registry);
    event VerifierSet(address indexed verifier);
    event ArbitrationSet(address indexed arbitration);
    event TreasurySet(address indexed treasury);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);

    function initialize(address admin, address taskRegistry, address verifier, address arbitration) external;

    function deposit(uint256 taskId, uint256 amount) external;
    function release(uint256 taskId, address freelancer, uint16 feeBps, address treasury) external;
    function refund(uint256 taskId) external;
    function resolveDispute(uint256 taskId, address winner) external;

    function setTaskRegistry(address registry) external;
    function setVerifier(address verifier_) external;
    function setArbitration(address arbitration_) external;
    function setTreasury(address treasury_) external;
    function setProtocolFeeBps(uint16 newBps) external;

    function escrowedOf(uint256 taskId) external view returns (uint256);
    function releasedOf(uint256 taskId) external view returns (bool);
    function taskRegistry() external view returns (address);
    function verifier() external view returns (address);
    function arbitration() external view returns (address);
    function treasury() external view returns (address);
    function protocolFeeBps() external view returns (uint16);
}