// SPDX-License-License: MIT
pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

import {ERC7857Upgradeable} from "./ERC7857Upgradeable.sol";
import {IntelligentData} from "./interfaces/IERC7857Metadata.sol";
import {IZeroLanceReputationNFT} from "./interfaces/IZeroLanceReputationNFT.sol";

using SafeERC20 for IERC20;
using Strings for uint256;

/// @title ZeroLanceReputationNFT
/// @notice ERC-7857 reputation receipt NFT with encrypted portfolio metadata
///         and a $ZERO-staked verified badge.
/// @dev Adapted from axiom-protocol's AxiomAgentNFT (MIT) and the 0G Agentic ID
///      reference (MIT). Inherits ERC7857Upgradeable for proof-verified iTransfer
///      (re-keyed metadata on transfer). The oracle re-keys the encrypted blob
///      on 0G Storage via /v1/transfer-validity, then signs an OwnershipProof;
///      the receiver signs an AccessProof; iTransfer verifies both via
///      ZeroLanceTeeVerifier.verifyTransferValidity.
contract ZeroLanceReputationNFT is
    ERC7857Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IZeroLanceReputationNFT
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 public constant MIN_STAKE = 1e18; // 1 $ZERO minimum for verified badge
    uint256 public constant UNSTAKE_TIMELOCK = 7 days;

    /// @custom:storage-location erc7201:zerolance.storage.ZeroLanceReputationNFT
    struct ReputationStorage {
        uint256 nextTokenId;
        IERC20 zeroToken; // $ZERO staking token
        address escrow; // authorized minter (passed verdict → mint receipt)
        address teeVerifier; // oracle that re-keys metadata on transfer
        mapping(uint256 => IntelligentData[]) iDatas; // per-token encrypted-metadata anchors
        mapping(uint256 => uint256) taskIds; // tokenId → completed task
        mapping(uint256 => address) freelancers; // tokenId → freelancer (immutable receipt owner)
        mapping(address => uint256) stakes; // freelancer → staked $ZERO
        mapping(address => uint256) unstakeReadyAt; // freelancer → timelock expiry
        uint256[42] __gap;
    }

    bytes32 private constant STORAGE_LOCATION =
        0x462546c718977ed6f79830c766541477a8d7388c3aff1509a8359ae989514591; // erc7201:zerolance.storage.ZeroLanceReputationNFT

    function _getStorage() private pure returns (ReputationStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address zeroToken_,
        address escrow_,
        address teeVerifier_,
        address admin
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();
        if (teeVerifier_ == address(0)) revert ZeroAddress();
        __ERC7857_init("ZeroLance Reputation", "ZLR", teeVerifier_);
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        ReputationStorage storage $ = _getStorage();
        $.zeroToken = IERC20(zeroToken_);
        $.escrow = escrow_;
        $.teeVerifier = teeVerifier_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, escrow_);
    }

    error ZeroAddress();
    error NotMinter();
    error ZeroAmount();
    error InsufficientStake();
    error UnstakeTimelocked(uint256 readyAt);
    error NotFreelancer();

    function setEscrow(address escrow_) external onlyRole(ADMIN_ROLE) {
        if (escrow_ == address(0)) revert ZeroAddress();
        _getStorage().escrow = escrow_;
    }

    /// @inheritdoc IZeroLanceReputationNFT
    /// @dev Only the escrow (MINTER_ROLE) mints receipts on a passed verdict.
    function mintReputation(
        address freelancer,
        uint256 taskId,
        string calldata dataDescription,
        bytes32 dataHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (freelancer == address(0)) revert ZeroAddress();
        ReputationStorage storage $ = _getStorage();
        tokenId = $.nextTokenId++;
        IntelligentData memory d = IntelligentData({dataDescription: dataDescription, dataHash: dataHash});
        $.iDatas[tokenId].push(d);
        $.taskIds[tokenId] = taskId;
        $.freelancers[tokenId] = freelancer;
        _safeMint(freelancer, tokenId);
        emit ReputationMinted(tokenId, freelancer, taskId);
    }

    /// @notice Append a portfolio entry (e.g., a new review) to an existing NFT.
    /// @dev Only the token owner may append; the dataHash anchors encrypted 0G Storage.
    function appendPortfolio(uint256 tokenId, string calldata dataDescription, bytes32 dataHash)
        external
        whenNotPaused
    {
        if (ownerOf(tokenId) != msg.sender) revert NotFreelancer();
        _getStorage().iDatas[tokenId].push(
            IntelligentData({dataDescription: dataDescription, dataHash: dataHash})
        );
    }

    /// @notice Re-key hook: the oracle updates the encrypted-metadata dataHash after a
    ///         transfer (ERC-7857 re-keying). Only the registered TEE verifier/oracle.
    function updateMetadata(uint256 tokenId, IntelligentData[] calldata newDatas) external whenNotPaused {
        ReputationStorage storage $ = _getStorage();
        if (msg.sender != $.teeVerifier) revert NotMinter();
        if (_ownerOf(tokenId) == address(0)) revert NotFreelancer();
        _updateData(tokenId, newDatas);
    }

    /// @inheritdoc IZeroLanceReputationNFT
    function stakeVerifiedBadge(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        ReputationStorage storage $ = _getStorage();
        $.zeroToken.safeTransferFrom(msg.sender, address(this), amount);
        $.stakes[msg.sender] += amount;
        $.unstakeReadyAt[msg.sender] = 0; // active stake resets timelock
        emit VerifiedBadgeStaked(msg.sender, amount);
    }

    /// @inheritdoc IZeroLanceReputationNFT
    /// @dev Unstaking starts a 7-day timelock; the badge is lost immediately but
    ///      funds are claimable only after the timelock (anti-gaming).
    function unstakeVerifiedBadge(uint256 amount) external whenNotPaused nonReentrant {
        ReputationStorage storage $ = _getStorage();
        if (amount == 0) revert ZeroAmount();
        if ($.stakes[msg.sender] < amount) revert InsufficientStake();
        // First unstake request starts the timelock.
        if ($.unstakeReadyAt[msg.sender] == 0) {
            $.unstakeReadyAt[msg.sender] = block.timestamp + UNSTAKE_TIMELOCK;
            emit VerifiedBadgeUnstaked(msg.sender, amount);
            return;
        }
        if (block.timestamp < $.unstakeReadyAt[msg.sender]) {
            revert UnstakeTimelocked($.unstakeReadyAt[msg.sender]);
        }
        $.stakes[msg.sender] -= amount;
        $.unstakeReadyAt[msg.sender] = 0;
        $.zeroToken.safeTransfer(msg.sender, amount);
        emit VerifiedBadgeUnstaked(msg.sender, amount);
    }

    /// @notice Slash a freelancer's stake (admin-gated; used by arbitration on collusion).
    function slashStake(address freelancer) external onlyRole(ADMIN_ROLE) nonReentrant {
        ReputationStorage storage $ = _getStorage();
        uint256 amount = $.stakes[freelancer];
        if (amount == 0) return;
        $.stakes[freelancer] = 0;
        $.unstakeReadyAt[freelancer] = 0;
        $.zeroToken.safeTransfer($.escrow, amount); // return to escrow / treasury
        emit VerifiedBadgeSlashed(freelancer, amount);
    }

    function isVerified(address freelancer) external view returns (bool) {
        return _getStorage().stakes[freelancer] >= MIN_STAKE;
    }

    function stakeOf(address freelancer) external view returns (uint256) {
        return _getStorage().stakes[freelancer];
    }

    function taskIdOf(uint256 tokenId) external view returns (uint256) {
        return _getStorage().taskIds[tokenId];
    }

    /// @notice OpenSea-compatible metadata JSON reconstructed from on-chain state.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        ReputationStorage storage $ = _getStorage();
        IntelligentData[] memory datas = $.iDatas[tokenId];
        string memory desc = datas.length > 0 ? datas[0].dataDescription : "ZeroLance reputation receipt";
        bytes memory json = abi.encodePacked(
            '{"name":"ZeroLance Reputation #', tokenId.toString(),
            '","description":"', desc,
            '","attributes":[{"trait_type":"task_id","value":"', $.taskIds[tokenId].toString(),
            '"},{"trait_type":"data_hash","value":"0x', _toHex(datas.length > 0 ? datas[0].dataHash : bytes32(0)),
            '"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _toHex(bytes32 b) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory out = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            out[i * 2] = hexChars[uint8(b[i]) >> 4];
            out[i * 2 + 1] = hexChars[uint8(b[i]) & 0x0f];
        }
        return string(out);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC7857Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ── ERC-7857 virtual overrides ──────────────────────────────────────

    /// @dev Returns the per-token IntelligentData[] (encrypted-metadata anchors).
    function _intelligentDatasOf(uint256 tokenId) internal view override returns (IntelligentData[] memory) {
        return _getStorage().iDatas[tokenId];
    }

    /// @dev Replaces all IntelligentData[] for a token (re-keying / metadata update).
    function _updateData(uint256 tokenId, IntelligentData[] memory newDatas) internal override {
        ReputationStorage storage $ = _getStorage();
        delete $.iDatas[tokenId];
        for (uint256 i = 0; i < newDatas.length; i++) {
            $.iDatas[tokenId].push(newDatas[i]);
        }
    }

    /// @dev Pausable-aware _update: blocks bare transfers (ERC7857 guard) and
    ///      enforces pause on all token movements.
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override(ERC7857Upgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
