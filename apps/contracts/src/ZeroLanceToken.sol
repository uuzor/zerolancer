// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/// @title ZeroLanceToken
/// @notice $ZERO — the governance/utility token for the ZeroLance protocol.
/// @dev Roles:
///      - Governance: holders vote on protocol upgrades and fee adjustments (Phase 2 Governor).
///      - Arbiter rewards: minted to arbiters on dispute resolution (MINTER_ROLE / owner).
///      - Staking: freelancers stake $ZERO for a verified badge (handled by ReputationNFT).
///      - Task boosting: clients burn $ZERO to boost urgent tasks (handled by TaskRegistry).
contract ZeroLanceToken is ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceToken
    struct TokenStorage {
        uint256 maxSupply; // immutable cap (0 = uncapped)
        uint256 minted;
        uint256[49] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xbeb39b993bdad58301f1e66dc13f60815cf985deda72954f05b771c5fd84addd; // erc7201:zerolance.storage.ZeroLanceToken

    function _getStorage() private pure returns (TokenStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param initialOwner The governance / deployer that holds mint authority until the Governor is live.
    /// @param initialSupply Minted to `initialOwner` at deployment.
    /// @param maxSupply_ Hard cap on total supply (0 = uncapped). Protects governance economics.
    function initialize(address initialOwner, uint256 initialSupply, uint256 maxSupply_) external initializer {
        if (initialOwner == address(0)) revert ZeroAddress();
        __ERC20_init("ZeroLance", "ZERO");
        __Ownable_init(initialOwner);
        __Pausable_init();
        __UUPSUpgradeable_init();
        TokenStorage storage $ = _getStorage();
        $.maxSupply = maxSupply_;
        if (initialSupply > 0) {
            _checkCap(initialSupply);
            $.minted = initialSupply;
            _mint(initialOwner, initialSupply);
        }
    }

    error ZeroAddress();
    error CapExceeded(uint256 requested, uint256 cap);
    error ZeroAmount();

    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        _checkCap(amount);
        _getStorage().minted += amount;
        _mint(to, amount);
    }

    /// @notice Burn $ZERO to boost a task's queue priority (client-side utility).
    function burn(uint256 amount) external whenNotPaused {
        _burn(msg.sender, amount);
    }

    /// @notice Burn on behalf of a holder (requires approval). Used for task boosting flows.
    function burnFrom(address account, uint256 amount) external whenNotPaused {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function maxSupply() external view returns (uint256) {
        return _getStorage().maxSupply;
    }

    function totalMinted() external view returns (uint256) {
        return _getStorage().minted;
    }

    function _checkCap(uint256 amount) internal view {
        TokenStorage storage $ = _getStorage();
        if ($.maxSupply != 0 && $.minted + amount > $.maxSupply) {
            revert CapExceeded(amount, $.maxSupply);
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
