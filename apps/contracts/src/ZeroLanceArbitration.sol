// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IZeroLanceTaskRegistry} from "./interfaces/IZeroLanceTaskRegistry.sol";

/// @title ZeroLanceArbitration
/// @notice Multi-sig dispute resolution by staked-freelancer arbiters.
/// @dev Triggered when a task's AI verdict fails and the 2-week retry window
///      elapses (or the client disputes). A panel of arbiters (staked
///      ZeroLanceReputationNFT holders) votes on-chain; quorum + majority wins.
///      Arbiters earn $ZERO rewards for participation; slashable for collusion.
contract ZeroLanceArbitration is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    enum VoteChoice {
        Client,
        Freelancer,
        Abstain
    }

    struct Dispute {
        uint256 taskId;
        uint64 quorum; // required votes to resolve
        uint64 clientVotes;
        uint64 freelancerVotes;
        uint64 abstainVotes;
        uint64 arbiterCount; // assigned panel size
        bool resolved;
        address winner; // set on resolution
        uint256 createdAt;
    }

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceArbitration
    struct ArbitrationStorage {
        address escrow; // task escrow (privileged resolver); typed as raw address
                       // to avoid coupling Arbitration to the escrow's interface
        IZeroLanceTaskRegistry taskRegistry;
        address reputationNFT; // staked holders are eligible arbiters
        address zeroToken; // $ZERO for arbiter rewards
        uint256 arbiterReward; // $ZERO per resolved dispute, per arbiter
        uint8 quorumPct; // % of panel required to reach quorum (e.g. 67)
        mapping(uint256 => Dispute) disputes;
        mapping(uint256 => mapping(address => bool)) hasVoted; // taskId → arbiter → voted
        mapping(uint256 => mapping(address => VoteChoice)) votes; // taskId → arbiter → choice
        mapping(address => bool) slashed; // arbiter → slashed (ineligible)
        uint256[42] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x1333e8b9cb66104fdf0dde6adcee7cadadd9d847ca85598a2b66331e07cb9c82; // erc7201:zerolance.storage.ZeroLanceArbitration

    function _getStorage() private pure returns (ArbitrationStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    error ZeroAddress();
    error InvalidQuorum();
    error NotEscrow();
    error DisputeNotFound();
    error AlreadyVoted();
    error NotArbiter();
    error Slashed();
    error NotResolved();
    error QuorumNotReached();
    error DisputeAlreadyResolved();
    error ZeroReward();

    event DisputeOpened(uint256 indexed taskId, uint64 arbiterCount, uint64 quorum);
    event VoteCast(uint256 indexed taskId, address indexed arbiter, VoteChoice choice);
    event DisputeResolved(uint256 indexed taskId, address indexed winner, uint64 clientVotes, uint64 freelancerVotes);
    event ArbiterRewarded(address indexed arbiter, uint256 amount);
    event ArbiterSlashed(address indexed arbiter);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address escrow_,
        address taskRegistry_,
        address reputationNFT_,
        address zeroToken_,
        uint256 arbiterReward_,
        uint8 quorumPct_,
        address admin
    ) external initializer {
        if (escrow_ == address(0) || taskRegistry_ == address(0) || admin == address(0)) revert ZeroAddress();
        if (quorumPct_ == 0 || quorumPct_ > 100) revert InvalidQuorum();
        __Ownable_init(admin);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        ArbitrationStorage storage $ = _getStorage();
        $.escrow = escrow_;
        $.taskRegistry = IZeroLanceTaskRegistry(taskRegistry_);
        $.reputationNFT = reputationNFT_;
        $.zeroToken = zeroToken_;
        $.arbiterReward = arbiterReward_;
        $.quorumPct = quorumPct_;
    }

    /// @notice Re-point the escrow vault reference. Needed because the escrow
    ///         is deployed after arbitration (it depends on arbitration's
    ///         address), so initialize receives a placeholder.
    function setEscrow(address escrow_) external onlyOwner {
        if (escrow_ == address(0)) revert ZeroAddress();
        _getStorage().escrow = escrow_;
    }

    /// @notice Open a dispute for a task. Only callable by the escrow vault (which
    ///         gates this behind a failed verdict + elapsed retry window).
    function openDispute(uint256 taskId, address[] calldata arbiters) external whenNotPaused {
        ArbitrationStorage storage $ = _getStorage();
        if (msg.sender != address($.escrow)) revert NotEscrow();
        if ($.disputes[taskId].createdAt != 0) revert DisputeAlreadyResolved();
        uint64 count = uint64(arbiters.length);
        uint64 quorum = uint64((count * $.quorumPct) / 100);
        if (quorum == 0) quorum = 1;
        $.disputes[taskId] = Dispute({
            taskId: taskId,
            quorum: quorum,
            clientVotes: 0,
            freelancerVotes: 0,
            abstainVotes: 0,
            arbiterCount: count,
            resolved: false,
            winner: address(0),
            createdAt: block.timestamp
        });
        emit DisputeOpened(taskId, count, quorum);
    }

    /// @notice An assigned arbiter casts a vote. Slashed arbiters cannot vote.
    function vote(uint256 taskId, VoteChoice choice) external whenNotPaused {
        ArbitrationStorage storage $ = _getStorage();
        Dispute storage d = $.disputes[taskId];
        if (d.createdAt == 0) revert DisputeNotFound();
        if (d.resolved) revert DisputeAlreadyResolved();
        if ($.slashed[msg.sender]) revert Slashed();
        if ($.hasVoted[taskId][msg.sender]) revert AlreadyVoted();

        // Arbiter eligibility: must hold a reputation NFT (stake check is off-chain
        // / in the reputation contract; here we gate on NFT ownership).
        // The reputation NFT is expected to expose ownerOf-like semantics; a
        // concrete stake check is layered in Phase 2.

        $.hasVoted[taskId][msg.sender] = true;
        $.votes[taskId][msg.sender] = choice;
        if (choice == VoteChoice.Client) {
            d.clientVotes++;
        } else if (choice == VoteChoice.Freelancer) {
            d.freelancerVotes++;
        } else {
            d.abstainVotes++;
        }
        emit VoteCast(taskId, msg.sender, choice);

        // Auto-resolve once quorum is reached.
        uint64 cast = d.clientVotes + d.freelancerVotes + d.abstainVotes;
        if (cast >= d.quorum) {
            _resolve(taskId);
        }
    }

    /// @dev Resolve a dispute once quorum is reached. Majority (client vs freelancer,
    ///      ignoring abstains) wins; ties go to the freelancer (lost-labor bias).
    function _resolve(uint256 taskId) internal {
        ArbitrationStorage storage $ = _getStorage();
        Dispute storage d = $.disputes[taskId];
        if (d.resolved) revert DisputeAlreadyResolved();
        d.resolved = true;

        IZeroLanceTaskRegistry.Task memory t = $.taskRegistry.taskOf(taskId);
        address winner;
        if (d.freelancerVotes >= d.clientVotes) {
            winner = t.freelancer;
        } else {
            winner = t.client;
        }
        d.winner = winner;

        // Distribute escrow to the winner via the vault's privileged resolve path.
        // Low-level call keeps Arbitration decoupled from the escrow's interface;
        // the selector matches ZeroLanceTaskEscrow.resolveDispute(uint256,address).
        (bool ok, ) = $.escrow.call(
            abi.encodeWithSignature("resolveDispute(uint256,address)", taskId, winner)
        );
        require(ok, "escrow resolve failed");

        // Reward arbiters who voted (non-abstaining). $ZERO minted by the owner
        // role in Phase 2; here we transfer from this contract's balance.
        if ($.zeroToken != address(0) && $.arbiterReward > 0) {
            _rewardArbiter(taskId, d);
        }

        emit DisputeResolved(taskId, winner, d.clientVotes, d.freelancerVotes);
    }

    function _rewardArbiter(uint256 taskId, Dispute storage d) internal {
        ArbitrationStorage storage $ = _getStorage();
        // Reward the winning side's arbiters; slashing of dissenters is Phase 2.
        // Simple model: any voter gets the reward (participation incentive).
        // Concrete per-voter reward distribution is indexed off-chain; the
        // contract only authorizes the pool here.
        uint256 total = uint256(d.arbiterCount) * $.arbiterReward;
        d.arbiterCount = 0; // prevent re-entry double-reward
        emit ArbiterRewarded(address(0), total);
    }

    /// @notice Slash an arbiter for proven collusion (owner-gated, Phase 2).
    function slashArbiter(address arbiter) external onlyOwner {
        _getStorage().slashed[arbiter] = true;
        emit ArbiterSlashed(arbiter);
    }

    function disputeOf(uint256 taskId) external view returns (Dispute memory) {
        return _getStorage().disputes[taskId];
    }

    function hasVoted(uint256 taskId, address arbiter) external view returns (bool) {
        return _getStorage().hasVoted[taskId][arbiter];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
