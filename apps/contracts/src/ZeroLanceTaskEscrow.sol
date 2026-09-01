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
import {IZeroLanceTeeVerifier} from "./interfaces/IZeroLanceTeeVerifier.sol";
import {IZeroLanceReputationNFT} from "./interfaces/IZeroLanceReputationNFT.sol";
import {IZeroLanceTaskEscrow} from "./interfaces/IZeroLanceTaskEscrow.sol";

using SafeERC20 for IERC20;

/// @title ZeroLanceTaskEscrow
/// @notice Simplified ERC-20 escrow for tasks. Absorbs verifier + dispute logic.
/// @dev UUPS upgradeable. ERC-7201 namespaced storage.
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
    struct EscrowStorage {
        IZeroLanceTaskRegistry taskRegistry;
        address treasury;
        uint16 protocolFeeBps;
        address teeVerifier;
        address reputationNft;
        address signer;
        mapping(uint256 => uint256) escrowed;
        mapping(uint256 => bool) released;
        mapping(uint256 => bool) verdictFailed;
        mapping(uint256 => uint256) verdictSubmittedAt;
        address arbitration;
        uint256[43] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xbf81f54f24fa36c0a25d4fcfae634c29cfbfd6b0122faf3f4e53324a59cea1c1;

    function _getStorage() private pure returns (EscrowStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address taskRegistry_,
        address treasury_,
        uint16 feeBps,
        address teeVerifier_,
        address reputationNft_,
        address signer_
    ) external initializer {
        if (admin == address(0) || taskRegistry_ == address(0) || treasury_ == address(0))
            revert ZeroAddress();
        if (teeVerifier_ == address(0) || reputationNft_ == address(0) || signer_ == address(0))
            revert ZeroAddress();
        if (feeBps > BPS_DENOMINATOR) revert InvalidBps();

        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        EscrowStorage storage $ = _getStorage();
        $.taskRegistry = IZeroLanceTaskRegistry(taskRegistry_);
        $.treasury = treasury_;
        $.protocolFeeBps = feeBps;
        $.teeVerifier = teeVerifier_;
        $.reputationNft = reputationNft_;
        $.signer = signer_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        _getStorage().treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setProtocolFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > BPS_DENOMINATOR) revert InvalidBps();
        EscrowStorage storage $ = _getStorage();
        uint16 old = $.protocolFeeBps;
        $.protocolFeeBps = newBps;
        emit FeeBpsUpdated(old, newBps);
    }

    function setArbitration(address arbitration_) external onlyOwner {
        if (arbitration_ == address(0)) revert ZeroAddress();
        _getStorage().arbitration = arbitration_;
        emit ArbitrationSet(arbitration_);
    }

    function setReputationNft(address nft) external onlyOwner {
        if (nft == address(0)) revert ZeroAddress();
        _getStorage().reputationNft = nft;
        emit ReputationNftSet(nft);
    }

    function setSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        _getStorage().signer = signer_;
        emit SignerSet(signer_);
    }

    function deposit(uint256 taskId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.client != msg.sender) revert NotClient();

        IERC20(t.paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        $.escrowed[taskId] += amount;
        emit Deposited(taskId, msg.sender, amount);
    }

    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict) external nonReentrant whenNotPaused {
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(verdict.taskId);
        if (t.status != IZeroLanceTaskRegistry.TaskStatus.InReview) revert WrongStatus();

        bool valid = IZeroLanceTeeVerifier($.teeVerifier).verifyVerdict(verdict);
        if (!valid) revert InvalidVerdict();

        if (verdict.passed) {
            _release(verdict.taskId);
        } else {
            $.verdictFailed[verdict.taskId] = true;
            $.verdictSubmittedAt[verdict.taskId] = block.timestamp;
            $.taskRegistry.setStatus(verdict.taskId, IZeroLanceTaskRegistry.TaskStatus.Disputed);
            emit VerdictFailed(verdict.taskId);
        }
    }

    function release(uint256 taskId, address freelancer, uint16 feeBps, address treasury_)
        external
        nonReentrant
        whenNotPaused
    {
        EscrowStorage storage $ = _getStorage();
        if (msg.sender != $.signer) revert NotSigner();
        if ($.released[taskId]) revert AlreadyReleased();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();
        if (freelancer == address(0)) revert ZeroAddress();
        if (feeBps > BPS_DENOMINATOR) revert InvalidBps();

        $.released[taskId] = true;
        $.escrowed[taskId] = 0;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Passed);

        uint256 fee = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 payout = amount - fee;

        IERC20 token = IERC20(t.paymentToken);
        address feeTo = treasury_ == address(0) ? $.treasury : treasury_;
        if (fee > 0 && feeTo != address(0)) token.safeTransfer(feeTo, fee);
        token.safeTransfer(freelancer, payout);

        emit Released(taskId, freelancer, payout, fee);
    }

    function refund(uint256 taskId) external nonReentrant whenNotPaused {
        EscrowStorage storage $ = _getStorage();
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
        EscrowStorage storage $ = _getStorage();
        if (msg.sender != $.signer) revert NotSigner();
        if (winner == address(0)) revert ZeroAddress();
        if ($.released[taskId]) revert AlreadyReleased();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();

        $.released[taskId] = true;
        $.escrowed[taskId] = 0;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Resolved);

        IERC20(t.paymentToken).safeTransfer(winner, amount);
        emit Resolved(taskId, winner, amount);
    }

    function mintReputation(uint256 taskId, string calldata description, bytes32 dataHash)
        external
        nonReentrant
        whenNotPaused
    {
        EscrowStorage storage $ = _getStorage();
        if (msg.sender != $.signer) revert NotSigner();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 tokenId = IZeroLanceReputationNFT($.reputationNft).mintReputation(
            t.freelancer,
            taskId,
            description,
            dataHash
        );
        emit ReputationMinted(taskId, t.freelancer, tokenId);
    }

    function _release(uint256 taskId) internal {
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();

        $.escrowed[taskId] = 0;
        $.released[taskId] = true;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Passed);

        uint256 bps = $.protocolFeeBps;
        uint256 fee = (amount * bps) / BPS_DENOMINATOR;
        uint256 payout = amount - fee;

        IERC20 token = IERC20(t.paymentToken);
        if (fee > 0 && $.treasury != address(0)) token.safeTransfer($.treasury, fee);
        token.safeTransfer(t.freelancer, payout);

        emit Released(taskId, t.freelancer, payout, fee);
    }

    function escrowedOf(uint256 taskId) external view returns (uint256) {
        return _getStorage().escrowed[taskId];
    }

    function releasedOf(uint256 taskId) external view returns (bool) {
        return _getStorage().released[taskId];
    }

    function protocolFeeBps() external view returns (uint16) {
        return _getStorage().protocolFeeBps;
    }

    function protocolTreasury() external view returns (address) {
        return _getStorage().treasury;
    }

    function signer() external view returns (address) {
        return _getStorage().signer;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
