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
import {IZeroLanceTaskRegistry} from "./interfaces/IZeroLanceTaskRegistry.sol";
import {IZeroLanceTaskEscrow} from "./interfaces/IZeroLanceTaskEscrow.sol";

using SafeERC20 for IERC20;

/// @title ZeroLanceTaskEscrow
/// @notice ERC-20 escrow for tasks. The TaskVerifier is the sole privileged caller
///         for `release` and `resolveDispute`. Funds-only — no task lifecycle logic.
contract ZeroLanceTaskEscrow is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceTaskEscrow
{
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceTaskEscrow
    struct TaskEscrowStorage {
        IZeroLanceTaskRegistry taskRegistry;
        address verifier;
        address arbitration;
        address treasury;
        uint16 protocolFeeBps;
        mapping(uint256 => uint256) escrowed;
        mapping(uint256 => bool) released;
        uint256[44] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x5b9a4d3e7c1f8a6b0d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8c;

    function _getStorage() private pure returns (TaskEscrowStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address taskRegistry_, address verifier_, address arbitration_)
        external
        initializer
    {
        if (admin == address(0) || taskRegistry_ == address(0) || verifier_ == address(0)) revert ZeroAddress();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        TaskEscrowStorage storage $ = _getStorage();
        $.taskRegistry = IZeroLanceTaskRegistry(taskRegistry_);
        $.verifier = verifier_;
        $.arbitration = arbitration_;
    }

    function setTaskRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        _getStorage().taskRegistry = IZeroLanceTaskRegistry(registry_);
        emit TaskRegistrySet(registry_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) revert ZeroAddress();
        _getStorage().verifier = verifier_;
        emit VerifierSet(verifier_);
    }

    function setArbitration(address arbitration_) external onlyOwner {
        if (arbitration_ == address(0)) revert ZeroAddress();
        _getStorage().arbitration = arbitration_;
        emit ArbitrationSet(arbitration_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        _getStorage().treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setProtocolFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > BPS_DENOMINATOR) revert InvalidBps();
        TaskEscrowStorage storage $ = _getStorage();
        uint16 old = $.protocolFeeBps;
        $.protocolFeeBps = newBps;
        emit FeeBpsUpdated(old, newBps);
    }

    function deposit(uint256 taskId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        TaskEscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.client != msg.sender) revert NotClient();

        IERC20(t.paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        $.escrowed[taskId] += amount;
        emit Deposited(taskId, msg.sender, amount);
    }

    function release(uint256 taskId, address freelancer, uint16 feeBps, address treasury_)
        external
        nonReentrant
        whenNotPaused
    {
        TaskEscrowStorage storage $ = _getStorage();
        if (msg.sender != $.verifier) revert NotVerifier();
        if ($.released[taskId]) revert AlreadyReleased();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();
        if (freelancer == address(0)) revert ZeroAddress();

        uint256 bps = feeBps;
        if (bps > BPS_DENOMINATOR) revert InvalidBps();

        uint256 fee = (amount * bps) / BPS_DENOMINATOR;
        uint256 payout = amount - fee;

        $.released[taskId] = true;
        $.escrowed[taskId] = 0;

        IERC20 token = IERC20(t.paymentToken);
        address feeTo = treasury_ == address(0) ? $.treasury : treasury_;
        if (fee > 0 && feeTo != address(0)) token.safeTransfer(feeTo, fee);
        token.safeTransfer(freelancer, payout);
        emit Released(taskId, freelancer, payout, fee);
    }

    function refund(uint256 taskId) external nonReentrant whenNotPaused {
        TaskEscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.client != msg.sender) revert NotClient();
        if (t.status != IZeroLanceTaskRegistry.TaskStatus.Open) revert WrongStatus();
        if ($.released[taskId]) revert AlreadyReleased();
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();

        $.escrowed[taskId] = 0;
        $.released[taskId] = true;

        IERC20(t.paymentToken).safeTransfer(t.client, amount);
        emit Refunded(taskId, t.client, amount);
    }

    function resolveDispute(uint256 taskId, address winner) external nonReentrant whenNotPaused {
        TaskEscrowStorage storage $ = _getStorage();
        if (msg.sender != $.arbitration && msg.sender != $.verifier) revert NotArbitration();
        if (winner == address(0)) revert ZeroAddress();
        if ($.released[taskId]) revert AlreadyReleased();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();

        $.released[taskId] = true;
        $.escrowed[taskId] = 0;
        IERC20(t.paymentToken).safeTransfer(winner, amount);
        emit Resolved(taskId, winner, amount);
    }

    function escrowedOf(uint256 taskId) external view returns (uint256) {
        return _getStorage().escrowed[taskId];
    }

    function releasedOf(uint256 taskId) external view returns (bool) {
        return _getStorage().released[taskId];
    }

    function taskRegistry() external view returns (address) {
        return address(_getStorage().taskRegistry);
    }

    function verifier() external view returns (address) {
        return _getStorage().verifier;
    }

    function arbitration() external view returns (address) {
        return _getStorage().arbitration;
    }

    function treasury() external view returns (address) {
        return _getStorage().treasury;
    }

    function protocolFeeBps() external view returns (uint16) {
        return _getStorage().protocolFeeBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}