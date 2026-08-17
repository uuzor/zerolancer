// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Utils
/// @notice Public-key and byte-comparison helpers used by ERC-7857 transfers.
/// @dev Re-implemented from the 0G Agentic ID reference (MIT) so that zerolancer
///      does not depend on the 0g-agent-nft package. The two functions are
///      self-contained and have no external dependencies.
library Utils {
    /// @notice Derive an Ethereum address from a 64-byte raw uncompressed public key (X||Y).
    /// @dev  Accepts the 64-byte form (no 0x04 prefix). If a 65-byte uncompressed key
    ///       (with 0x04 prefix) is passed, the prefix is stripped. The address is the
    ///       last 20 bytes of keccak256(pubkey).
    function pubKeyToAddress(bytes memory pubkey) internal pure returns (address) {
        bytes memory raw = pubkey;
        if (raw.length == 65 && uint8(raw[0]) == 0x04) {
            raw = _slice(raw, 1, 64);
        }
        require(raw.length == 64, "Utils: invalid pubkey length");
        bytes32 hash = keccak256(raw);
        return address(uint160(uint256(hash)));
    }

    /// @notice Constant-time-ish byte equality check.
    function bytesEqual(bytes memory a, bytes memory b) internal pure returns (bool) {
        if (a.length != b.length) return false;
        return keccak256(a) == keccak256(b);
    }

    function _slice(bytes memory data, uint256 start, uint256 len) private pure returns (bytes memory) {
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = data[start + i];
        }
        return out;
    }
}
