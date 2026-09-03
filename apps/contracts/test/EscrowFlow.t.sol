// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {ZeroLanceTaskRegistry} from "src/ZeroLanceTaskRegistry.sol";
import {IZeroLanceTaskRegistry} from "src/interfaces/IZeroLanceTaskRegistry.sol";
import {ZeroLanceTaskEscrow} from "src/ZeroLanceTaskEscrow.sol";
import {IZeroLanceTaskEscrow} from "src/interfaces/IZeroLanceTaskEscrow.sol";
import {ZeroLanceTeeVerifier} from "src/verifiers/ZeroLanceTeeVerifier.sol";
import {IZeroLanceTeeVerifier} from "src/interfaces/IZeroLanceTeeVerifier.sol";
import {ZeroLanceReputationNFT} from "src/ZeroLanceReputationNFT.sol";

/// @title EscrowFlowTest
/// @notice Tests for the simplified ZeroLanceTaskEscrow contract.
/// @dev Exercises deposit/release via verdict, refund, dispute flow,
///      and access control gates.
contract EscrowFlowTest is Test {
    MockUSDC usdc;
    ZeroLanceTaskRegistry registry;
    ZeroLanceTeeVerifier teeVerifier;
    ZeroLanceReputationNFT reputation;
    ZeroLanceTaskEscrow escrow;

    address admin = makeAddr("admin");
    address client = makeAddr("client");
    address freelancer = makeAddr("freelancer");
    address treasury = makeAddr("treasury");

    // TEE signer keypair.
    uint256 constant SIGNER_PK = 0xA11CE;
    address teeSigner;

    uint16 constant FEE_BPS = 250; // 2.5%

    function setUp() public {
        teeSigner = vm.addr(SIGNER_PK);

        usdc = new MockUSDC();
        usdc.faucet(client, 1_000_000e6);

        // 1) TEE verifier.
        ZeroLanceTeeVerifier teeImpl = new ZeroLanceTeeVerifier();
        teeVerifier = ZeroLanceTeeVerifier(address(
            new ERC1967Proxy(
                address(teeImpl),
                abi.encodeWithSelector(
                    ZeroLanceTeeVerifier.initialize.selector, admin, teeSigner, 7 days
                )
            )
        ));

        // 2) Task registry.
        ZeroLanceTaskRegistry regImpl = new ZeroLanceTaskRegistry();
        registry = ZeroLanceTaskRegistry(address(
            new ERC1967Proxy(
                address(regImpl),
                abi.encodeWithSelector(
                    ZeroLanceTaskRegistry.initialize.selector, admin, address(escrow)
                )
            )
        ));

        // 3) Reputation NFT.
        ZeroLanceReputationNFT repImpl = new ZeroLanceReputationNFT();
        reputation = ZeroLanceReputationNFT(address(
            new ERC1967Proxy(
                address(repImpl),
                abi.encodeWithSelector(
                    ZeroLanceReputationNFT.initialize.selector,
                    address(0), // zero token
                    address(0), // placeholder escrow (will overwrite)
                    address(teeVerifier),
                    admin
                )
            )
        ));

        // 4) Task escrow.
        ZeroLanceTaskEscrow escImpl = new ZeroLanceTaskEscrow();
        escrow = ZeroLanceTaskEscrow(address(
            new ERC1967Proxy(
                address(escImpl),
                abi.encodeWithSelector(
                    ZeroLanceTaskEscrow.initialize.selector,
                    admin,
                    address(registry),
                    treasury,
                    FEE_BPS,
                    address(teeVerifier),
                    address(reputation),
                    teeSigner
                )
            )
        ));

        // 5) Wire cross-references.
        vm.prank(admin);
        registry.setAuthorizedSetter(address(escrow));
        vm.prank(admin);
        reputation.setEscrow(address(escrow));
        bytes32 minterRole = reputation.MINTER_ROLE();
        vm.prank(admin);
        reputation.grantRole(minterRole, address(escrow));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    function _createTask() internal returns (uint256 taskId) {
        vm.prank(client);
        taskId = registry.createTask(
            keccak256("spec"),
            IZeroLanceTaskRegistry.TaskCategory.Code,
            address(usdc),
            100_000e6,
            block.timestamp + 30 days,
            "https://github.com/org/repo",
            42,
            8000
        );
    }

    function _createAndDeposit() internal returns (uint256 taskId) {
        taskId = _createTask();
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(client);
        registry.assignTask(taskId, freelancer);
        vm.prank(client);
        escrow.deposit(taskId, 100_000e6);
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
                address(teeVerifier)
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

    function test_DepositReleaseFlow() public {
        uint256 taskId = _createAndDeposit();
        bytes32 deliverableHash = keccak256("deliverable");

        // Freelancer submits deliverable.
        vm.prank(freelancer);
        registry.submitDeliverable(taskId, deliverableHash, 1);

        // Sign a passing verdict.
        bytes32 nonce = keccak256("nonce1");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, true, 9000, nonce, validUntil);

        uint256 freelancerBefore = usdc.balanceOf(freelancer);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Submit verdict to escrow.
        escrow.submitVerdict(v);

        // 2.5% fee on 100_000e6 = 2_500e6 to treasury; 97_500e6 to freelancer.
        assertEq(usdc.balanceOf(freelancer) - freelancerBefore, 97_500e6, "freelancer payout");
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 2_500e6, "treasury fee");
        assertEq(
            uint8(registry.taskOf(taskId).status),
            uint8(IZeroLanceTaskRegistry.TaskStatus.Passed),
            "status Passed"
        );
    }

    function test_Refund_OpenTask() public {
        uint256 taskId = _createTask();

        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(client);
        escrow.deposit(taskId, 100_000e6);

        uint256 balBefore = usdc.balanceOf(client);
        vm.prank(client);
        escrow.refund(taskId);
        assertEq(usdc.balanceOf(client) - balBefore, 100_000e6, "client refunded");
        assertTrue(escrow.releasedOf(taskId), "marked released");
    }

    function test_FailedVerdict_SetsDisputed() public {
        uint256 taskId = _createAndDeposit();
        bytes32 deliverableHash = keccak256("deliverable");

        vm.prank(freelancer);
        registry.submitDeliverable(taskId, deliverableHash, 1);

        // Sign a failing verdict.
        bytes32 nonce = keccak256("nonce-fail");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, false, 2000, nonce, validUntil);

        escrow.submitVerdict(v);
        assertEq(
            uint8(registry.taskOf(taskId).status),
            uint8(IZeroLanceTaskRegistry.TaskStatus.Disputed),
            "status Disputed after fail"
        );
    }

    function test_OnlyClientCanDeposit() public {
        uint256 taskId = _createTask();

        vm.expectRevert(IZeroLanceTaskEscrow.NotClient.selector);
        vm.prank(freelancer);
        escrow.deposit(taskId, 100_000e6);
    }

    function test_ResolveDispute_SignerOnly() public {
        uint256 taskId = _createAndDeposit();
        bytes32 deliverableHash = keccak256("deliverable");

        vm.prank(freelancer);
        registry.submitDeliverable(taskId, deliverableHash, 1);

        bytes32 nonce = keccak256("nonce-fail2");
        uint256 validUntil = block.timestamp + 1 days;
        IZeroLanceTeeVerifier.Verdict memory v =
            _signVerdict(taskId, deliverableHash, false, 2000, nonce, validUntil);

        escrow.submitVerdict(v);

        uint256 freelancerBefore = usdc.balanceOf(freelancer);
        // Signer resolves dispute in favor of freelancer.
        vm.prank(teeSigner);
        escrow.resolveDispute(taskId, freelancer);
        assertEq(usdc.balanceOf(freelancer) - freelancerBefore, 100_000e6, "freelancer gets full amount");
    }

    function test_Verifier_OnlyPrivilegedCaller() public {
        uint256 taskId = _createAndDeposit();

        // Arbitrary caller tries release → revert NotVerifier.
        vm.expectRevert(IZeroLanceTaskEscrow.NotSigner.selector);
        vm.prank(freelancer);
        escrow.release(taskId, freelancer, FEE_BPS, treasury);
    }
}
