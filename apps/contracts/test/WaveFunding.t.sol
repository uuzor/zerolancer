// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {WaveFundingVault} from "src/zerolancewave/WaveFundingVault.sol";
import {IWaveFundingVault} from "src/zerolancewave/IWaveFundingVault.sol";

/// @title WaveFundingTest
/// @notice Tests for the simplified WaveFundingVault contract.
/// @dev Exercises createProgram, deposit, wave lifecycle (open/close/finalize),
///      points, claims, emergency withdraw, and access control.
contract WaveFundingTest is Test {
    MockUSDC usdc;
    WaveFundingVault vault;

    address admin = makeAddr("admin");
    address organizer = makeAddr("organizer");
    address builderA = makeAddr("builderA");
    address builderB = makeAddr("builderB");
    address treasury = makeAddr("treasury");
    address signer = makeAddr("signer");

    uint16 constant FEE_BPS = 250; // 2.5%

    function setUp() public {
        usdc = new MockUSDC();

        WaveFundingVault impl = new WaveFundingVault();
        vault = WaveFundingVault(address(
            new ERC1967Proxy(
                address(impl),
                abi.encodeWithSelector(
                    WaveFundingVault.initialize.selector, admin, treasury, signer
                )
            )
        ));

        usdc.faucet(organizer, 10_000_000e6);
        usdc.faucet(builderA, 1_000_000e6);
        usdc.faucet(builderB, 1_000_000e6);

        vm.prank(organizer);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _createProgram(uint256 genesisPool, uint16 numWaves) internal returns (uint256 programId) {
        vm.prank(organizer);
        programId = vault.createProgram(
            address(usdc),
            genesisPool,
            numWaves,
            FEE_BPS,
            treasury,
            bytes32("spec")
        );
    }

    function _openCloseFinalize(uint256 programId) internal returns (uint256 waveId) {
        vm.prank(organizer);
        waveId = vault.openWave(programId);
        vm.prank(organizer);
        vault.closeWave(programId, waveId);
        vm.prank(organizer);
        vault.finalizeWave(programId, waveId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 1: createProgram + deposit
    // ─────────────────────────────────────────────────────────────────────

    function test_CreateProgramAndDeposit() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _createProgram(genesis, 3);

        assertGt(programId, 0, "programId > 0");
        assertEq(vault.pooled(programId), genesis, "pooled == genesis after create");

        vm.prank(organizer);
        vault.deposit(programId, 50_000e6);
        assertEq(vault.pooled(programId), genesis + 50_000e6, "pooled == genesis + deposit");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 2: open + finalize wave (FixedPerWave budget)
    // ─────────────────────────────────────────────────────────────────────

    function test_OpenAndFinalizeWave() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _createProgram(genesis, 3);

        vm.prank(organizer);
        vault.deposit(programId, genesis);

        vm.prank(organizer);
        uint256 waveId = vault.openWave(programId);
        assertEq(vault.waveCount(programId), 1, "waveCount == 1");

        vm.prank(organizer);
        vault.closeWave(programId, waveId);
        vm.prank(organizer);
        vault.finalizeWave(programId, waveId);

        IWaveFundingVault.Wave memory wave = vault.wave(waveId);
        assertEq(uint8(wave.status), uint8(IWaveFundingVault.WaveStatus.Finalized), "wave Finalized");
        // Budget = genesisPool / numWaves (FixedPerWave)
        assertEq(wave.budget, genesis / 3, "budget = genesisPool / numWaves");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 3: PctOfRemaining budget method
    // ─────────────────────────────────────────────────────────────────────

    function test_PctOfRemaining_Budget() public {
        uint256 genesis = 200_000e6;
        uint256 programId = _createProgram(genesis, 2);

        vm.prank(organizer);
        vault.deposit(programId, genesis);

        uint256 waveId = _openCloseFinalize(programId);

        IWaveFundingVault.Wave memory wave = vault.wave(waveId);
        // PctOfRemaining: pooled / (numWaves - waveSeq + 1) = 200k / 2 = 100k
        assertEq(wave.budget, genesis / 2, "budget = pooled / remaining");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 4: setPoints + claim (pro-rata distribution, net of fee)
    // ─────────────────────────────────────────────────────────────────────

    function test_SetPointsAndClaim() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _createProgram(genesis, 3);

        vm.prank(organizer);
        vault.deposit(programId, genesis);

        vm.prank(organizer);
        uint256 waveId = vault.openWave(programId);

        // Set points while wave is Open.
        vm.prank(signer);
        vault.setPoints(waveId, builderA, 200);
        vm.prank(signer);
        vault.setPoints(waveId, builderB, 100);

        assertEq(vault.totalWavePoints(waveId), 300, "totalWavePoints == 300");

        vm.prank(organizer);
        vault.closeWave(programId, waveId);
        vm.prank(organizer);
        vault.finalizeWave(programId, waveId);

        // Budget = genesisPool / numWaves = 100_000e6
        // netBudget = 100_000e6 * (10000 - 250) / 10000 = 97_500e6
        // builderA share = 97_500e6 * 200/300 = 65_000e6
        // builderB share = 97_500e6 * 100/300 = 32_500e6
        uint256 netBudget = 97_500e6;
        uint256 shareA = netBudget * 200 / 300;
        uint256 shareB = netBudget * 100 / 300;

        assertEq(shareA, 65_000e6, "expected shareA");
        assertEq(shareB, 32_500e6, "expected shareB");

        uint256 balABefore = usdc.balanceOf(builderA);
        vm.prank(builderA);
        vault.claim(waveId, builderA);
        assertEq(usdc.balanceOf(builderA) - balABefore, shareA, "builderA claim");

        uint256 balBBefore = usdc.balanceOf(builderB);
        vm.prank(builderB);
        vault.claim(waveId, builderB);
        assertEq(usdc.balanceOf(builderB) - balBBefore, shareB, "builderB claim");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 5: zero points cannot claim
    // ─────────────────────────────────────────────────────────────────────

    function test_ZeroPointsCannotClaim() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.prank(organizer);
        vault.deposit(programId, 300_000e6);

        uint256 waveId = _openCloseFinalize(programId);

        vm.expectRevert(IWaveFundingVault.ZeroBudget.selector);
        vm.prank(builderA);
        vault.claim(waveId, builderA);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 6: double claim reverts
    // ─────────────────────────────────────────────────────────────────────

    function test_DoubleClaimReverts() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.prank(organizer);
        vault.deposit(programId, 300_000e6);

        vm.prank(organizer);
        uint256 waveId = vault.openWave(programId);

        vm.prank(signer);
        vault.setPoints(waveId, builderA, 100);

        vm.prank(organizer);
        vault.closeWave(programId, waveId);
        vm.prank(organizer);
        vault.finalizeWave(programId, waveId);

        vm.prank(builderA);
        vault.claim(waveId, builderA);

        vm.expectRevert(IWaveFundingVault.AlreadyClaimed.selector);
        vm.prank(builderA);
        vault.claim(waveId, builderA);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 7: claim before finalize reverts
    // ─────────────────────────────────────────────────────────────────────

    function test_ClaimBeforeFinalizeReverts() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.prank(organizer);
        vault.deposit(programId, 300_000e6);

        vm.prank(organizer);
        uint256 waveId = vault.openWave(programId);

        vm.prank(signer);
        vault.setPoints(waveId, builderA, 100);

        vm.expectRevert(IWaveFundingVault.WrongStatus.selector);
        vm.prank(builderA);
        vault.claim(waveId, builderA);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 8: emergency withdraw
    // ─────────────────────────────────────────────────────────────────────

    function test_EmergencyWithdraw() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.prank(organizer);
        vault.deposit(programId, 300_000e6);

        uint256 balBefore = usdc.balanceOf(organizer);
        vm.prank(admin);
        vault.emergencyWithdraw(programId, organizer, 300_000e6);
        assertEq(usdc.balanceOf(organizer) - balBefore, 300_000e6, "organizer received funds");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 9: only organizer can open wave
    // ─────────────────────────────────────────────────────────────────────

    function test_NotOrganizerCannotOpenWave() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.expectRevert(IWaveFundingVault.NotOrganizer.selector);
        vm.prank(builderA);
        vault.openWave(programId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 10: only signer can set points
    // ─────────────────────────────────────────────────────────────────────

    function test_NotSignerCannotSetPoints() public {
        uint256 programId = _createProgram(300_000e6, 3);

        vm.prank(organizer);
        vault.deposit(programId, 300_000e6);

        vm.prank(organizer);
        uint256 waveId = vault.openWave(programId);

        vm.expectRevert(IWaveFundingVault.NotSigner.selector);
        vm.prank(builderA);
        vault.setPoints(waveId, builderA, 100);
    }
}
