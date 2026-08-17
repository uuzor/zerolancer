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
import {TimelockManager} from "./libraries/TimelockManager.sol";
import {IZeroLanceTaskRegistry} from "./interfaces/IZeroLanceTaskRegistry.sol";
import {IZeroLanceTeeVerifier} from "./interfaces/IZeroLanceTeeVerifier.sol";
import {IZeroLanceEscrowVault} from "./interfaces/IZeroLanceEscrowVault.sol";
import {IZeroLanceArbitration} from "./interfaces/IZeroLanceArbitration.sol";
import {IZeroLanceReputationNFT} from "./interfaces/IZeroLanceReputationNFT.sol";

using SafeERC20 for IERC20;
using TimelockManager for TimelockManager.State;

/// @title ZeroLanceEscrowVault
/// @notice ERC-20 escrow that auto-releases funds to a freelancer on a passed AI verdict.
/// @dev Adapted from axiom-protocol's AxiomStrategyVault (vault + Merkle execute) and
///      AxiomPaymentProcessor (ERC-20 fee split). The "strategy/Merkle action" model is
///      replaced by an oracle-signed verdict: a passed verdict is the authorization to release.
/// @dev Flow:
///      1. Client deposits USDC for a task (after createTask on the registry).
///      2. Freelancer submits deliverable (via the registry → InReview).
///      3. Oracle (TEE) signs a Verdict; anyone submits it via submitVerdict.
///         - passed → auto-release to freelancer, platform fee to treasury.
///         - failed → retry window (2 weeks) opens; on expiry → dispute escalation.
///      4. On dispute, funds lock until ZeroLanceArbitration resolves.
contract ZeroLanceEscrowVault is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceEscrowVault
{
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant RETRY_WINDOW = 14 days;

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceEscrowVault
    struct EscrowStorage {
        IZeroLanceTaskRegistry taskRegistry;
        IZeroLanceTeeVerifier verifier;
        address protocolTreasury;
        uint16 protocolFeeBps; // 2–3% = 200–300 bps
        TimelockManager.State treasuryTimelock;
        mapping(uint256 => uint256) escrowed; // taskId → deposited amount
        mapping(uint256 => bool) released; // taskId → funds distributed
        mapping(uint256 => bool) verdictFailed; // taskId → entered retry window
        mapping(uint256 => uint256) verdictSubmittedAt; // taskId → timestamp of failed verdict
        /// @notice Authorized arbitration contract that may resolve disputes on-chain.
        address arbitration;
        /// @notice Reputation NFT contract (escrow holds MINTER_ROLE).
        address reputationNft;
        uint256[43] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0xbf81f54f24fa36c0a25d4fcfae634c29cfbfd6b0122faf3f4e53324a59cea1c1; // erc7201:zerolance.storage.ZeroLanceEscrowVault

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
        address taskRegistry_,
        address verifier_,
        address treasury_,
        uint16 protocolFeeBps_,
        address arbitration_,
        address initialOwner
    ) external initializer {
        if (taskRegistry_ == address(0) || verifier_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (protocolFeeBps_ > BPS_DENOMINATOR) revert InvalidBps();
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        EscrowStorage storage $ = _getStorage();
        $.taskRegistry = IZeroLanceTaskRegistry(taskRegistry_);
        $.verifier = IZeroLanceTeeVerifier(verifier_);
        $.protocolTreasury = treasury_;
        $.protocolFeeBps = protocolFeeBps_;
        $.arbitration = arbitration_;
        // The authorized setter is wired externally by the deployer after both
        // contracts are deployed (avoids a circular init dependency: the escrow
        // cannot be the registry owner at init time because the registry must
        // exist before the escrow can reference it).
    }

    function setArbitration(address arbitration_) external onlyOwner {
        if (arbitration_ == address(0)) revert ZeroAddress();
        _getStorage().arbitration = arbitration_;
    }

    /// @notice Set the reputation NFT contract (escrow must already hold MINTER_ROLE).
    function setReputationNft(address reputationNft_) external onlyOwner {
        if (reputationNft_ == address(0)) revert ZeroAddress();
        _getStorage().reputationNft = reputationNft_;
    }

    /// @notice Mint a reputation NFT to the task's freelancer after a passed verdict.
    /// Called by the operator after escrow release. The escrow (as MINTER_ROLE
    /// holder) forwards the mint to the reputation contract.
    function mintReputationForTask(
        uint256 taskId,
        string calldata dataDescription,
        bytes32 dataHash
    ) external onlyOwner returns (uint256 tokenId) {
        EscrowStorage storage $ = _getStorage();
        if ($.reputationNft == address(0)) revert ZeroAddress();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        tokenId = IZeroLanceReputationNFT($.reputationNft).mintReputation(
            t.freelancer,
            taskId,
            dataDescription,
            dataHash
        );
    }

    function proposeProtocolTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        EscrowStorage storage $ = _getStorage();
        $.treasuryTimelock.propose(newTreasury);
        emit ProtocolTreasuryProposed(newTreasury, block.timestamp + TimelockManager.DELAY);
    }

    function executeProtocolTreasury() external onlyOwner {
        EscrowStorage storage $ = _getStorage();
        address old = $.protocolTreasury;
        $.protocolTreasury = $.treasuryTimelock.execute();
        emit ProtocolTreasuryUpdated(old, $.protocolTreasury);
    }

    function setProtocolFeeBps(uint16 newBps) external onlyOwner {
        if (newBps > BPS_DENOMINATOR) revert InvalidBps();
        EscrowStorage storage $ = _getStorage();
        uint16 old = $.protocolFeeBps;
        $.protocolFeeBps = newBps;
        emit ProtocolFeeBpsUpdated(old, newBps);
    }

    /// @notice Client deposits USDC into escrow for a task. Pulls `amount` of the task's
    ///         payment token from the caller via safeTransferFrom (must pre-approve).
    function deposit(uint256 taskId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.client != msg.sender) revert NotClient();
        if (t.status == IZeroLanceTaskRegistry.TaskStatus.Cancelled) {
            revert TaskNotAssigned();
        }

        IERC20 token = IERC20(t.paymentToken);
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balBefore;

        $.escrowed[taskId] += received;
        emit Deposited(taskId, msg.sender, received);
    }

    /// @notice Freelancer submits the deliverable hash (delegates to the registry).
    function submitDeliverable(uint256 taskId, bytes32 deliverableHash, uint64 prNumber) external whenNotPaused {
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.freelancer != msg.sender) revert NotFreelancer();
        $.taskRegistry.submitDeliverable(taskId, deliverableHash, prNumber);
        emit DeliverableSubmitted(taskId, deliverableHash);
    }

    /// @notice Submit an oracle-signed AI verdict. Permissionless: any caller may relay.
    /// @dev A `passed` verdict auto-releases escrow (minus platform fee). A `failed`
    ///      verdict opens the 2-week retry window; on expiry the client or freelancer
    ///      may escalate to dispute.
    function submitVerdict(IZeroLanceTeeVerifier.Verdict calldata verdict)
        external
        nonReentrant
        whenNotPaused
    {
        EscrowStorage storage $ = _getStorage();
        // Validate the verdict is for an existing task and matches the submitted deliverable.
        if (verdict.taskId >= $.taskRegistry.nextTaskId()) revert TaskNotAssigned();
        IZeroLanceTaskRegistry.Task memory task = $.taskRegistry.taskOf(verdict.taskId);
        if (task.status != IZeroLanceTaskRegistry.TaskStatus.InReview) {
            revert WrongStatus(task.status);
        }
        if (task.deliverableHash != verdict.deliverableHash) revert DeliverableMismatch();

        // Trust anchor: only the registered TEE signer's verdict is honored.
        if (!$.verifier.verifyVerdict(verdict)) revert NotAuthorizedVerifier();

        if (verdict.passed) {
            _release(verdict.taskId, task);
        } else {
            $.verdictFailed[verdict.taskId] = true;
            $.verdictSubmittedAt[verdict.taskId] = block.timestamp;
            $.taskRegistry.setStatus(verdict.taskId, IZeroLanceTaskRegistry.TaskStatus.Disputed);
        }
        emit VerdictSubmitted(verdict.taskId, verdict.passed, verdict.score);
    }

    /// @dev Internal release: splits escrow between freelancer and protocol treasury.
    function _release(uint256 taskId, IZeroLanceTaskRegistry.Task memory task) internal {
        EscrowStorage storage $ = _getStorage();
        if ($.released[taskId]) revert AlreadyReleased();
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();

        // CEI: state first.
        $.released[taskId] = true;
        $.escrowed[taskId] = 0;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Passed);

        uint256 fee = (amount * $.protocolFeeBps) / BPS_DENOMINATOR;
        uint256 payout = amount - fee;
        IERC20 token = IERC20(task.paymentToken);
        if (fee > 0) token.safeTransfer($.protocolTreasury, fee);
        token.safeTransfer(task.freelancer, payout);
        emit Released(taskId, task.freelancer, payout, fee);
    }

    /// @notice Client refunds a task that was never assigned (status = Open).
    function refund(uint256 taskId) external nonReentrant whenNotPaused {
        EscrowStorage storage $ = _getStorage();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if (t.client != msg.sender) revert NotClient();
        if (t.status != IZeroLanceTaskRegistry.TaskStatus.Open) revert TaskNotAssigned();
        if ($.released[taskId]) revert AlreadyReleased();

        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();
        $.escrowed[taskId] = 0;
        $.released[taskId] = true;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Cancelled);
        IERC20(t.paymentToken).safeTransfer(t.client, amount);
        emit Refunded(taskId, t.client, amount);
    }

    /// @notice Escalate a failed-verdict task to dispute after the retry window elapses.
    function escalateDispute(uint256 taskId, address[] calldata arbiters) external whenNotPaused {
        EscrowStorage storage $ = _getStorage();
        if (!$.verdictFailed[taskId]) revert VerdictFailed();
        if (block.timestamp < $.verdictSubmittedAt[taskId] + RETRY_WINDOW) revert RetryWindowOpen();
        if (arbiters.length == 0) revert ZeroAddress();
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Disputed);
        // Open the on-chain dispute in the arbitration contract. The escrow is
        // the authorized caller (arbitration.openDispute requires msg.sender == escrow).
        IZeroLanceArbitration($.arbitration).openDispute(taskId, arbiters);
        emit DisputeEscalated(taskId);
    }

    /// @notice Called by the arbitration contract to distribute funds after a vote.
    /// @param winner The address that receives the escrowed funds (client or freelancer).
    function resolveDispute(uint256 taskId, address winner) external nonReentrant {
        EscrowStorage storage $ = _getStorage();
        if (msg.sender != $.arbitration) revert NotAuthorizedVerifier();
        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        if ($.released[taskId]) revert AlreadyReleased();
        uint256 amount = $.escrowed[taskId];
        if (amount == 0) revert InsufficientEscrow();
        $.released[taskId] = true;
        $.escrowed[taskId] = 0;
        $.taskRegistry.setStatus(taskId, IZeroLanceTaskRegistry.TaskStatus.Resolved);
        // No platform fee on arbitrated resolution (disputes are a failure mode).
        IERC20(t.paymentToken).safeTransfer(winner, amount);
        emit Released(taskId, winner, amount, 0);
    }

    // ── Views ──────────────────────────────────────────────────────────────────
    function escrowedOf(uint256 taskId) external view returns (uint256) {
        return _getStorage().escrowed[taskId];
    }

    function releasedOf(uint256 taskId) external view returns (bool) {
        return _getStorage().released[taskId];
    }

    function protocolFeeBps() external view returns (uint256) {
        return _getStorage().protocolFeeBps;
    }

    function protocolTreasury() external view returns (address) {
        return _getStorage().protocolTreasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // Events not in the interface (timelock + dispute internal).
    event ProtocolTreasuryProposed(address indexed proposedTreasury, uint256 effectiveAt);
    error WrongStatus(IZeroLanceTaskRegistry.TaskStatus actual);
    error DeliverableMismatch();
}
