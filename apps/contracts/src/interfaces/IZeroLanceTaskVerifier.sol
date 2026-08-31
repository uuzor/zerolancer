// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IZeroLanceTeeVerifier} from "./IZeroLanceTeeVerifier.sol";

/// @title IZeroLanceTaskVerifier
/// @notice Task lifecycle: deliverable submission, verdict relay, dispute escalation,
///         reputation minting. Bridges the registry, TEE verifier, escrow, arbitration,
///         and reputation NFT contracts.
interface IZeroLanceTaskVerifier {
    error ZeroAddress();
    error NotFreelancer();
    error NotOperator();
    error NotAuthorizedVerifier();
    error WrongStatus();
    error DeliverableMismatch();
    error RetryWindowOpen();

    event DeliverableSubmitted(uint256 indexed taskId, bytes32 deliverableHash, uint64 prNumber);
    event VerdictSubmitted(uint256 indexed taskId, bool passed, uint256 score);
    event DisputeEscalated(uint256 indexed taskId);
    event ReputationMinted(uint256 indexed taskId, uint256 indexed tokenId, address indexed freelancer);
    event OperatorSet(address indexed operator, bool allowed);

    function initialize(
        address admin,
        address taskRegistry,
        address teeVerifier,
        address taskEscrow,
        address reputationNft,
        address arbitration
    ) external;

    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external;
    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict) external;
    function escalateDispute(uint256 taskId, address[] calldata arbiters) external;
    function mintReputationForTask(uint256 taskId, string calldata dataDescription, bytes32 dataHash)
        external
        returns (uint256 tokenId);

    function setOperator(address who, bool allowed) external;
}