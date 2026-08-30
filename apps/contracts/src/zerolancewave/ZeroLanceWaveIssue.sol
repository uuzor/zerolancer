// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZeroLanceWaveIssue} from "./IZeroLanceWaveIssue.sol";

/// @title ZeroLanceWaveIssue
/// @notice Wave Issue mode is now handled off-chain. This contract is a stub
///         kept for ABI compatibility and to allow the deploy script to succeed.
///         All issue lifecycle logic (create, claim, submit PR, award) lives in
///         the backend database; the contract only anchors references via events.
contract ZeroLanceWaveIssue is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IZeroLanceWaveIssue
{
    uint256 public nextIssueId;

    constructor() { _disableInitializers(); }

    function initialize(address admin) external initializer {
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
    }

    function acceptRepo(uint256, bytes32, bool) external pure {}

    function createIssue(
        uint256 programId,
        bytes32,
        bytes32 specHash,
        uint256 basePoints,
        uint64
    ) external returns (uint256 issueId) {
        issueId = nextIssueId++;
        emit IssueCreated(programId, issueId, msg.sender, basePoints, specHash);
    }

    function setIssuePoints(uint256, uint256) external pure {}

    function claimIssue(uint256 issueId) external {
        emit IssueClaimed(issueId, msg.sender, 0);
    }

    function submitPr(uint256 issueId, bytes32 deliverableHash, uint64 prNumber) external {
        emit IssuePrSubmitted(issueId, deliverableHash, prNumber);
    }

    function confirmMerge(uint256 issueId) external {
        emit IssueMerged(issueId, msg.sender, 0);
    }

    function addCompliment(uint256 issueId, uint256 points) external {
        emit ComplimentAdded(issueId, points);
    }

    function issue(uint256) external pure returns (Issue memory) {
        return Issue({
            programId: 0,
            waveId: 0,
            maintainer: address(0),
            builder: address(0),
            specHash: bytes32(0),
            repoHash: bytes32(0),
            basePoints: 0,
            bonusPoints: 0,
            deliveredPr: 0,
            deliverableHash: bytes32(0),
            complexity: 0,
            state: 0,
            pointsAwarded: false
        });
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
