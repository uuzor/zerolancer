// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IWaveFundingEscrow} from "./IWaveFundingEscrow.sol";

using SafeERC20 for IERC20;

/// @title WaveFundingEscrow
/// @notice Funds-only vault for any wave program. Holds a single shared ERC-20
///         (the protocol's USDC) and per-program pooled/distributed/waveBudget
///         accounting. No program, wave, or project state lives here.
contract WaveFundingEscrow is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IWaveFundingEscrow
{
    /// @custom:storage-location erc7201:zerolance.storage.WaveFundingEscrow
    struct EscrowStorage {
        address verifier;
        address treasury;
        mapping(uint256 => address) programToken;
        mapping(uint256 => uint256) pooled;
        mapping(uint256 => uint256) distributed;
        mapping(uint256 => mapping(uint256 => uint256)) waveBudgets;
        uint256[46] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x9a7c1f3e2b5d4801c0e7f3a9b2d5c8e1f4a7b0c3d6e9f1a4b7c0d3e6f9a2b5c8;

    function _getStorage() private pure returns (EscrowStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address treasury_, address verifier_) external initializer {
        if (admin == address(0) || treasury_ == address(0) || verifier_ == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        EscrowStorage storage $ = _getStorage();
        $.treasury = treasury_;
        $.verifier = verifier_;
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) revert ZeroAddress();
        _getStorage().verifier = verifier_;
        emit VerifierSet(verifier_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        _getStorage().treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    modifier onlyVerifier() {
        if (msg.sender != _getStorage().verifier) revert NotVerifier();
        _;
    }

    /// @notice Anyone can deposit into a program. Pulls `amount` of `token` from caller
    ///         via safeTransferFrom and credits `pooled[programId]`.
    function deposit(uint256 programId, address token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) revert ZeroAddress();
        EscrowStorage storage $ = _getStorage();
        address existing = $.programToken[programId];
        if (existing == address(0)) {
            $.programToken[programId] = token;
        } else if (existing != token) {
            revert ZeroAddress();
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        $.pooled[programId] += amount;
        emit Deposited(programId, msg.sender, amount);
    }

    /// @notice Verifier-only claim. CEI: state before transfer.
    function claim(uint256 programId, uint256 waveId, address who, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyVerifier
    {
        if (who == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        EscrowStorage storage $ = _getStorage();
        uint256 available = $.pooled[programId] - $.distributed[programId];
        if (amount > available) revert InsufficientPool();
        $.distributed[programId] += amount;
        IERC20($.programToken[programId]).safeTransfer(who, amount);
        emit Claimed(programId, waveId, who, amount);
    }

    function setWaveBudget(uint256 programId, uint256 waveId, uint256 budget) external onlyVerifier {
        _getStorage().waveBudgets[programId][waveId] = budget;
        emit WaveBudgetSet(programId, waveId, budget);
    }

    function emergencyWithdraw(uint256 programId, uint256 amount, address to)
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        EscrowStorage storage $ = _getStorage();
        uint256 available = $.pooled[programId] - $.distributed[programId];
        if (amount > available) revert InsufficientPool();
        $.distributed[programId] += amount;
        IERC20($.programToken[programId]).safeTransfer(to, amount);
        emit EmergencyWithdrawn(programId, to, amount);
    }

    function pooled(uint256 programId) external view returns (uint256) {
        return _getStorage().pooled[programId];
    }

    function distributed(uint256 programId) external view returns (uint256) {
        return _getStorage().distributed[programId];
    }

    function waveBudgetOf(uint256 programId, uint256 waveId) external view returns (uint256) {
        return _getStorage().waveBudgets[programId][waveId];
    }

    function programToken(uint256 programId) external view returns (address) {
        return _getStorage().programToken[programId];
    }

    function verifier() external view returns (address) {
        return _getStorage().verifier;
    }

    function treasury() external view returns (address) {
        return _getStorage().treasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}