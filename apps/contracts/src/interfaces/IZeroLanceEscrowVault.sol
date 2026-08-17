// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IZeroLanceTeeVerifier} from "./IZeroLanceTeeVerifier.sol";

/// @title IZeroLanceEscrowVault
/// @notice ERC-20 escrow vault that auto-releases funds on a passed AI verdict.
interface IZeroLanceEscrowVault {
    error ZeroAddress();
    error ZeroAmount();
    error NotClient();
    error NotFreelancer();
    error NotAuthorizedVerifier();
    error TaskNotAssigned();
    error AlreadyReleased();
    error VerdictFailed();
    error RetryWindowOpen();
    error InsufficientEscrow();
    error TransferFailed();
    error InvalidBps();

    event Deposited(uint256 indexed taskId, address indexed client, uint256 amount);
    event DeliverableSubmitted(uint256 indexed taskId, bytes32 deliverableHash);
    event VerdictSubmitted(uint256 indexed taskId, bool passed, uint256 score);
    event Released(uint256 indexed taskId, address indexed freelancer, uint256 amount, uint256 fee);
    event Refunded(uint256 indexed taskId, address indexed client, uint256 amount);
    event DisputeEscalated(uint256 indexed taskId);
    event ProtocolFeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event ProtocolTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    function deposit(uint256 taskId, uint256 amount) external;
    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external;
    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict) external;
    function refund(uint256 taskId) external;
    function escalateDispute(uint256 taskId, address[] calldata arbiters) external;
    function resolveDispute(uint256 taskId, address winner) external;
    function setReputationNft(address reputationNft) external;
    function mintReputationForTask(uint256 taskId, string calldata dataDescription, bytes32 dataHash) external returns (uint256);

    function escrowedOf(uint256 taskId) external view returns (uint256);
    function releasedOf(uint256 taskId) external view returns (bool);
    function protocolFeeBps() external view returns (uint256);
    function protocolTreasury() external view returns (address);
}
