// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceReputationNFT
/// @notice ERC-7857 reputation NFT — receipt per completed task with portable,
///        encrypted portfolio metadata and a $ZERO-staked verified badge.
interface IZeroLanceReputationNFT {
    event ReputationMinted(uint256 indexed tokenId, address indexed freelancer, uint256 indexed taskId);
    event VerifiedBadgeStaked(address indexed freelancer, uint256 amount);
    event VerifiedBadgeUnstaked(address indexed freelancer, uint256 amount);
    event VerifiedBadgeSlashed(address indexed freelancer, uint256 amount);

    /// @notice Mint a reputation receipt NFT to a freelancer for a completed task.
    /// @dev Only callable by the escrow vault (on a passed verdict) or an authorized minter.
    function mintReputation(
        address freelancer,
        uint256 taskId,
        string calldata dataDescription,
        bytes32 dataHash
    ) external returns (uint256 tokenId);

    /// @notice Stake $ZERO to obtain/maintain a verified badge (higher task visibility).
    function stakeVerifiedBadge(uint256 amount) external;

    /// @notice Unstake $ZERO (subject to a timelock to prevent gaming).
    function unstakeVerifiedBadge(uint256 amount) external;

    function isVerified(address freelancer) external view returns (bool);
    function stakeOf(address freelancer) external view returns (uint256);
    function taskIdOf(uint256 tokenId) external view returns (uint256);
}
