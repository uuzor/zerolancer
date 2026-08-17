// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IZeroLanceArbitration
/// @notice Minimal interface for the escrow vault to call into arbitration.
interface IZeroLanceArbitration {
    function openDispute(uint256 taskId, address[] calldata arbiters) external;
    function resolveDispute(uint256 taskId, address winner) external;
}
