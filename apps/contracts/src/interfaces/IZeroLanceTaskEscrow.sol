// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IZeroLanceTeeVerifier} from "./IZeroLanceTeeVerifier.sol";

/// @title IZeroLanceTaskEscrow
/// @notice Simplified ERC-20 escrow for tasks. Absorbs verifier + dispute logic.
/// @dev The backend signer is the privileged caller for release, resolveDispute, and mintReputation.
interface IZeroLanceTaskEscrow {
    error ZeroAddress();
    error ZeroAmount();
    error NotClient();
    error NotSigner();
    error WrongStatus();
    error InsufficientEscrow();
    error AlreadyReleased();
    error AlreadyClaimed();
    error InvalidBps();
    error ZeroBudget();
    error InvalidVerdict();

    event Deposited(uint256 indexed taskId, address indexed client, uint256 amount);
    event Released(uint256 indexed taskId, address indexed freelancer, uint256 amount, uint256 fee);
    event Refunded(uint256 indexed taskId, address indexed client, uint256 amount);
    event Resolved(uint256 indexed taskId, address indexed winner, uint256 amount);
    event ReputationMinted(uint256 indexed taskId, address indexed freelancer, uint256 tokenId);
    event VerdictFailed(uint256 indexed taskId);
    event TaskRegistrySet(address indexed registry);
    event TreasurySet(address indexed treasury);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event ArbitrationSet(address indexed arbitration);
    event ReputationNftSet(address indexed nft);
    event SignerSet(address indexed signer);

    function initialize(
        address admin,
        address taskRegistry,
        address treasury,
        uint16 feeBps,
        address teeVerifier,
        address reputationNft,
        address signer
    ) external;

    function deposit(uint256 taskId, uint256 amount) external;
    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict) external;
    function release(uint256 taskId, address freelancer, uint16 feeBps, address treasury) external;
    function refund(uint256 taskId) external;
    function resolveDispute(uint256 taskId, address winner) external;
    function mintReputation(uint256 taskId, string calldata description, bytes32 dataHash) external;

    function setTreasury(address treasury_) external;
    function setProtocolFeeBps(uint16 newBps) external;
    function setArbitration(address arbitration_) external;
    function setReputationNft(address nft) external;
    function setSigner(address signer_) external;

    function escrowedOf(uint256 taskId) external view returns (uint256);
    function releasedOf(uint256 taskId) external view returns (bool);
    function protocolFeeBps() external view returns (uint16);
    function protocolTreasury() external view returns (address);
    function signer() external view returns (address);
}
