// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {ZeroLanceTaskRegistry} from "src/ZeroLanceTaskRegistry.sol";
import {ZeroLanceTeeVerifier} from "src/verifiers/ZeroLanceTeeVerifier.sol";
import {ZeroLanceEscrowVault} from "src/ZeroLanceEscrowVault.sol";
import {ZeroLanceArbitration} from "src/ZeroLanceArbitration.sol";
import {ZeroLanceReputationNFT} from "src/ZeroLanceReputationNFT.sol";
import {IZeroLanceTeeVerifier} from "src/interfaces/IZeroLanceTeeVerifier.sol";
import {IZeroLanceTaskRegistry} from "src/interfaces/IZeroLanceTaskRegistry.sol";
import {IZeroLanceEscrowVault} from "src/interfaces/IZeroLanceEscrowVault.sol";

/// @title EscrowFlowTest
/// @notice Validates the contract-level fixes for the contract→backend flow:
///         1. Dispute escalation calls arbitration.openDispute (FIX 2).
///         2. Reputation NFT minting via escrow (FIX 3).
///         3. Full lifecycle: create → assign → deposit → deliverable → verdict → release.
contract EscrowFlowTest is Test {
    MockUSDC usdc;
    ZeroLanceTaskRegistry registry;
    ZeroLanceTeeVerifier verifier;
    ZeroLanceEscrowVault escrow;
    ZeroLanceArbitration arbitration;
    ZeroLanceReputationNFT reputation;

    address admin = makeAddr("admin");
    address client = makeAddr("client");
    address freelancer = makeAddr("freelancer");
    address treasury = makeAddr("treasury");

    // TEE signer keypair
    uint256 constant SIGNER_PK = 0xA11CE;
    address teeSigner;

    address arbiter1 = makeAddr("arbiter1");
    address arbiter2 = makeAddr("arbiter2");
    address arbiter3 = makeAddr("arbiter3");

    function setUp() public {
        teeSigner = vm.addr(SIGNER_PK);

        usdc = new MockUSDC();
        usdc.faucet(client, 1_000_000e6);

        // Deploy registry (proxy)
        ZeroLanceTaskRegistry regImpl = new ZeroLanceTaskRegistry();
        bytes memory regInit = abi.encodeWithSelector(
            ZeroLanceTaskRegistry.initialize.selector,
            admin,
            address(0) // authorizedSetters set later
        );
        registry = ZeroLanceTaskRegistry(address(new ERC1967Proxy(address(regImpl), regInit)));

        // Deploy TEE verifier (proxy)
        ZeroLanceTeeVerifier verImpl = new ZeroLanceTeeVerifier();
        bytes memory verInit = abi.encodeWithSelector(
            ZeroLanceTeeVerifier.initialize.selector,
            admin,
            teeSigner,
            7 days
        );
        verifier = ZeroLanceTeeVerifier(address(new ERC1967Proxy(address(verImpl), verInit)));

        // Deploy arbitration (proxy) — escrow not yet deployed, so use placeholder
        // then re-point via setEscrow() (mirrors Deploy.s.sol step 8).
        ZeroLanceArbitration arbImpl = new ZeroLanceArbitration();
        bytes memory arbInit = abi.encodeWithSelector(
            ZeroLanceArbitration.initialize.selector,
            address(1), // placeholder escrow, re-pointed below
            address(registry),
            address(0), // reputation NFT (set later)
            address(0), // zero token (optional)
            0,
            51, // 51% quorum
            admin
        );
        arbitration = ZeroLanceArbitration(address(new ERC1967Proxy(address(arbImpl), arbInit)));

        // Deploy escrow (proxy)
        ZeroLanceEscrowVault escImpl = new ZeroLanceEscrowVault();
        bytes memory escInit = abi.encodeWithSelector(
            ZeroLanceEscrowVault.initialize.selector,
            address(registry),
            address(verifier),
            treasury,
            300, // 3% fee
            address(arbitration),
            admin
        );
        escrow = ZeroLanceEscrowVault(address(new ERC1967Proxy(address(escImpl), escInit)));

        // Wire arbitration's escrow pointer to the real escrow address.
        vm.prank(admin);
        arbitration.setEscrow(address(escrow));

        // Deploy reputation NFT (proxy) — escrow gets MINTER_ROLE
        ZeroLanceReputationNFT repImpl = new ZeroLanceReputationNFT();
        bytes memory repInit = abi.encodeWithSelector(
            ZeroLanceReputationNFT.initialize.selector,
            address(0), // zero token
            address(escrow),
            address(verifier),
            admin
        );
        reputation = ZeroLanceReputationNFT(address(new ERC1967Proxy(address(repImpl), repInit)));

        // Wire reputation NFT into escrow
        vm.prank(admin);
        escrow.setReputationNft(address(reputation));

        // Authorize escrow as status setter on registry
        vm.prank(admin);
        registry.setAuthorizedSetter(address(escrow));

        vm.deal(client, 10 ether);
        vm.deal(freelancer, 10 ether);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    function _createTask() internal returns (uint256 taskId) {
        vm.startPrank(client);
        usdc.approve(address(escrow), type(uint256).max);
        taskId = registry.createTask(
            keccak256("spec"),
            IZeroLanceTaskRegistry.TaskCategory.Code,
            address(usdc),
            1000e6,
            block.timestamp + 30 days,
            "https://github.com/org/repo",
            42,
            8000
        );
        registry.assignTask(taskId, freelancer);
        escrow.deposit(taskId, 1000e6);
        vm.stopPrank();
    }

    function _submitDeliverable(uint256 taskId, bytes32 deliverableHash) internal {
        vm.prank(freelancer);
        escrow.submitDeliverable(taskId, deliverableHash, 0);
    }

    function _signVerdict(
        uint256 taskId,
        bytes32 deliverableHash,
        bool passed,
        uint256 score,
        bytes32 nonce,
        uint256 validUntil
    ) internal view returns (IZeroLanceTeeVerifier.Verdict memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Verdict(uint256 taskId,bytes32 deliverableHash,bool passed,uint256 score,bytes32 nonce,uint256 validUntil)"
                ),
                taskId,
                deliverableHash,
                passed,
                score,
                nonce,
                validUntil
            )
        );
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("ZeroLanceTeeVerifier"),
                keccak256("1"),
                block.chainid,
                address(verifier)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        return IZeroLanceTeeVerifier.Verdict({
            taskId: taskId,
            deliverableHash: deliverableHash,
            passed: passed,
            score: score,
            nonce: nonce,
            validUntil: validUntil,
            signature: signature
        });
    }

    // ─── Tests ──────────────────────────────────────────────────────────────

    function test_FullLifecycle_PassedVerdict_ReleasesAndMints() public {
        uint256 taskId = _createTask();
        bytes32 deliverableHash = keccak256("deliverable");
        _submitDeliverable(taskId, deliverableHash);

        // Sign a PASSING verdict
        bytes32 nonce = keccak256("nonce1");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, true, 9000, nonce, validUntil);

        uint256 freelancerBefore = usdc.balanceOf(freelancer);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Anyone can submit the verdict (permissionless)
        escrow.submitVerdict(v);

        // Funds released: 1000 USDC, 3% fee = 30 to treasury, 970 to freelancer
        assertEq(usdc.balanceOf(freelancer) - freelancerBefore, 970e6, "freelancer payout");
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 30e6, "treasury fee");
        assertEq(uint8(registry.taskOf(taskId).status), uint8(IZeroLanceTaskRegistry.TaskStatus.Passed), "status Passed");

        // Mint reputation NFT for the completed task
        bytes32 dataHash = keccak256("reputation-data");
        vm.prank(admin);
        uint256 tokenId = escrow.mintReputationForTask(taskId, "AI-verified delivery", dataHash);
        assertEq(tokenId, 0, "first tokenId");
        assertEq(reputation.ownerOf(tokenId), freelancer, "NFT owner = freelancer");
        assertEq(reputation.taskIdOf(tokenId), taskId, "NFT taskId linked");
    }

    function test_FailedVerdict_ThenEscalate_OpensDispute() public {
        uint256 taskId = _createTask();
        bytes32 deliverableHash = keccak256("deliverable");
        _submitDeliverable(taskId, deliverableHash);

        // Sign a FAILING verdict
        bytes32 nonce = keccak256("nonce-fail");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, false, 2000, nonce, validUntil);

        escrow.submitVerdict(v);
        assertEq(uint8(registry.taskOf(taskId).status), uint8(IZeroLanceTaskRegistry.TaskStatus.Disputed), "status Disputed after fail");

        // Warp past the 14-day retry window
        vm.warp(block.timestamp + 15 days);

        // Escalate with arbiters — this should call arbitration.openDispute internally
        address[] memory arbiters = new address[](3);
        arbiters[0] = arbiter1;
        arbiters[1] = arbiter2;
        arbiters[2] = arbiter3;

        escrow.escalateDispute(taskId, arbiters);

        // Verify the dispute was opened in arbitration by voting and resolving
        // Quorum at 51% of 3 arbiters = 1.53 → floored to 1, so a single vote resolves.
        vm.prank(arbiter1);
        arbitration.vote(taskId, ZeroLanceArbitration.VoteChoice.Freelancer);

        // After vote reaches quorum, _resolve calls escrow.resolveDispute → funds to freelancer
        assertEq(uint8(registry.taskOf(taskId).status), uint8(IZeroLanceTaskRegistry.TaskStatus.Resolved), "status Resolved");
        assertEq(usdc.balanceOf(freelancer), 1000e6, "freelancer gets full escrow (no fee on dispute)");
    }

    function test_RevertIf_EscalateWithoutArbiters() public {
        uint256 taskId = _createTask();
        bytes32 deliverableHash = keccak256("deliverable");
        _submitDeliverable(taskId, deliverableHash);

        bytes32 nonce = keccak256("nonce-fail2");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, false, 1000, nonce, validUntil);

        escrow.submitVerdict(v);
        vm.warp(block.timestamp + 15 days);

        address[] memory empty = new address[](0);
        vm.expectRevert(IZeroLanceEscrowVault.ZeroAddress.selector);
        escrow.escalateDispute(taskId, empty);
    }

    function test_RevertIf_EscalateBeforeRetryWindowElapses() public {
        uint256 taskId = _createTask();
        bytes32 deliverableHash = keccak256("deliverable");
        _submitDeliverable(taskId, deliverableHash);

        bytes32 nonce = keccak256("nonce-fail3");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, false, 1000, nonce, validUntil);

        escrow.submitVerdict(v);

        // Try to escalate immediately (retry window still open)
        address[] memory arbiters = new address[](1);
        arbiters[0] = arbiter1;
        vm.expectRevert(IZeroLanceEscrowVault.RetryWindowOpen.selector);
        escrow.escalateDispute(taskId, arbiters);
    }

    function test_RevertIf_MintReputationBeforeConfigured() public {
        // Deploy a fresh escrow without reputationNft set
        ZeroLanceEscrowVault escImpl = new ZeroLanceEscrowVault();
        bytes memory escInit = abi.encodeWithSelector(
            ZeroLanceEscrowVault.initialize.selector,
            address(registry),
            address(verifier),
            treasury,
            300,
            address(arbitration),
            admin
        );
        ZeroLanceEscrowVault freshEscrow = ZeroLanceEscrowVault(address(new ERC1967Proxy(address(escImpl), escInit)));

        vm.prank(admin);
        vm.expectRevert(IZeroLanceEscrowVault.ZeroAddress.selector);
        freshEscrow.mintReputationForTask(0, "desc", bytes32(0));
    }
}
