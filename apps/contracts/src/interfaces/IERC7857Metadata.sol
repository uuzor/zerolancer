// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice IntelligentData entry — encrypted metadata anchored by a 0G Storage root hash.
/// @dev Adapted from the 0G Agentic ID reference (MIT) / EIP-7857.
struct IntelligentData {
    string dataDescription; // human-readable per-data-slice metadata
    bytes32 dataHash; // root hash of the encrypted blob stored on 0G Storage
}

interface IERC7857Metadata {
    function intelligentDatasOf(uint256 tokenId) external view returns (IntelligentData[] memory);

    /// @notice Alias for intelligentDatasOf (EIP-7857 uses singular form).
    function intelligentDataOf(uint256 tokenId) external view returns (IntelligentData[] memory data);
}
