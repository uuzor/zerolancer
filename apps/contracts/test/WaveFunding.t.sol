// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {PointsLedger} from "src/zerolancewave/PointsLedger.sol";
import {ZeroLanceWaveProgram} from "src/zerolancewave/ZeroLanceWaveProgram.sol";
import {ZeroLanceWaveIssue} from "src/zerolancewave/ZeroLanceWaveIssue.sol";
import {ZeroLanceWaveBuildathon} from "src/zerolancewave/ZeroLanceWaveBuildathon.sol";
import {IZeroLanceWaveProgram} from "src/zerolancewave/IZeroLanceWaveProgram.sol";
import {IZeroLanceWaveIssue} from "src/zerolancewave/IZeroLanceWaveIssue.sol";

/// @title WaveFundingTest
/// @notice Exercises the two new funding modes (Wave Issue + Wave Buildathon) on the
///         shared WaveProgram: program creation, deposits, wave lifecycle, points,
///         and proportional claimable distribution.
contract WaveFundingTest is Test {
    MockUSDC usdc;
    ZeroLanceWaveProgram program;
    ZeroLanceWaveIssue waveIssue;
    ZeroLanceWaveBuildathon buildathon;

    address admin = makeAddr("admin");
    address organizer = makeAddr("organizer");
    address builderA = makeAddr("builderA");
    address builderB = makeAddr("builderB");
    address treasury = makeAddr("treasury");
    address maintainer = makeAddr("maintainer");

    uint256 constant GENESIS = 3_000_000e6; // 3M USDC 6-decimals
    uint256 constant FEE_BPS = 250; // 2.5%

    function _deployProgram(uint256 genesis, IZeroLanceWaveProgram.BudgetMethod budgetMethod)
        internal
        returns (uint256 programId)
    {
        usdc.faucet(organizer, genesis + 1_000_000e6);
        vm.prank(organizer);
        usdc.approve(address(program), genesis);

        vm.prank(organizer);
        programId = program.createWaveProgram(
            address(usdc),
            genesis,
            3, // numWaves
            1 days, // build window
            1 days, // eval window
            0, // compliment window
            budgetMethod,
            uint16(FEE_BPS),
            treasury,
            bytes32("spec")
        );
    }

    function setUp() public {
        usdc = new MockUSDC();

        // ZeroLanceWaveProgram (proxy)
        ZeroLanceWaveProgram progImpl = new ZeroLanceWaveProgram();
        bytes memory progInit =
            abi.encodeWithSelector(ZeroLanceWaveProgram.initialize.selector, admin);
        program = ZeroLanceWaveProgram(address(new ERC1967Proxy(address(progImpl), progInit)));

        // ZeroLanceWaveIssue (proxy)
        ZeroLanceWaveIssue wiImpl = new ZeroLanceWaveIssue();
        bytes memory wiInit = abi.encodeWithSelector(
            ZeroLanceWaveIssue.initialize.selector,
            admin,
            address(program)
        );
        waveIssue = ZeroLanceWaveIssue(address(new ERC1967Proxy(address(wiImpl), wiInit)));

        // ZeroLanceWaveBuildathon (proxy)
        ZeroLanceWaveBuildathon baImpl = new ZeroLanceWaveBuildathon();
        bytes memory baInit = abi.encodeWithSelector(
            ZeroLanceWaveBuildathon.initialize.selector,
            admin,
            address(program)
        );
        buildathon = ZeroLanceWaveBuildathon(address(new ERC1967Proxy(address(baImpl), baInit)));

        // Grant the program the authority to award on behalf of both modes by
        // granting the mode contracts as awarders on the program.
    }

    // ── Buildathon flow ──────────────────────────────────────────────────

    function test_Buildathon_DistributesProportionally() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _deployProgram(genesis, IZeroLanceWaveProgram.BudgetMethod.FixedPerWave);

        IZeroLanceWaveProgram.Program memory p = program.program(programId);
        // Grant the buildathon contract as an awarder for this program so judge
        // points route through.
        vm.prank(organizer);
        program.grantAwarder(programId, address(buildathon), true);

        // Open wave 0.
        vm.prank(organizer);
        uint256 waveId = program.openWave(programId);

        // Teams register.
        vm.prank(organizer);
        buildathon.registerTeam(programId, builderA, bytes32("repoA"));
        uint256 teamB;
        vm.prank(organizer);
        teamB = buildathon.registerTeam(programId, builderB, bytes32("repoB"));

        // Submit demos during build window.
        vm.startPrank(organizer);
        uint256 subA = buildathon.submit(programId, 0, bytes32("demoA"), bytes32("repoA"));
        uint256 subB = buildathon.submit(programId, teamB, bytes32("demoB"), bytes32("repoB"));
        vm.stopPrank();

        // Close build -> evaluation; judges score.
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeWave(programId, waveId); // -> Evaluation, evalEndAt = now+evalWindow

        // Judge scores: A gets 200 points, B gets 100 points.
        vm.startPrank(organizer);
        buildathon.setSubmissionPoints(programId, subA, 200);
        buildathon.setSubmissionPoints(programId, subB, 100);
        vm.stopPrank();

        // total points = 300, wave budget = genesis/3 = 100k USDC, netBudget=97.5k
        assertEq(program.pointsLedger(programId).totalPoints(waveId), 300);

        // Close evaluation -> freeze points; finalize.
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeEvaluation(programId, waveId);
        vm.prank(organizer);
        program.finalizeWave(programId, waveId);

        uint256 budget = program.waveBudget(programId, waveId);
        assertEq(budget, genesis / 3); // FixedPerWave
        uint256 netBudget = program.totalClaimable(programId, waveId);
        assertEq(netBudget, (budget * 9750) / 10000);

        // Share A = (200/300) * netBudget ; B = (100/300) * netBudget
        uint256 shareA = program.claimableShare(programId, waveId, builderA);
        uint256 shareB = program.claimableShare(programId, waveId, builderB);
        assertEq(shareA, (netBudget * 2) / 3);
        assertEq(shareB, netBudget / 3);

        // Claim by both (budget from deposit already held by program).
        // Note: builderA/builderB need the token balance to be able to receive.
        uint256 balA0 = usdc.balanceOf(builderA);
        vm.prank(builderA);
        program.claim(programId, waveId);
        assertEq(usdc.balanceOf(builderA) - balA0, shareA);

        uint256 balB0 = usdc.balanceOf(builderB);
        vm.prank(builderB);
        program.claim(programId, waveId);
        assertEq(usdc.balanceOf(builderB) - balB0, shareB);
    }

    function test_Buildathon_ZeroPointsCannotClaim() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _deployProgram(genesis, IZeroLanceWaveProgram.BudgetMethod.FixedPerWave);
        vm.prank(organizer);
        program.grantAwarder(programId, address(buildathon), true);

        vm.prank(organizer);
        uint256 waveId = program.openWave(programId);
        vm.prank(organizer);
        buildathon.registerTeam(programId, builderA, bytes32("repoA"));
        vm.prank(organizer);
        uint256 subA = buildathon.submit(programId, 0, bytes32("demoA"), bytes32("repoA"));

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeWave(programId, waveId);
        vm.warp(block.timestamp + 2 days + 2);
        vm.prank(organizer);
        program.closeEvaluation(programId, waveId);
        vm.prank(organizer);
        program.finalizeWave(programId, waveId);

        // No points -> nothing to claim.
        assertEq(program.pointsLedger(programId).totalPoints(waveId), 0);
        assertEq(program.claimableShare(programId, waveId, builderA), 0);
    }

    // ── Wave Issue flow ──────────────────────────────────────────────────

    function test_WaveIssue_MergeAwardsAndDistributes() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _deployProgram(genesis, IZeroLanceWaveProgram.BudgetMethod.FixedPerWave);
        vm.prank(organizer);
        program.grantAwarder(programId, address(waveIssue), true);

        // Organizer accepts a repo into the wave program.
        bytes32 repoHash = bytes32("org/repo");
        vm.prank(organizer);
        waveIssue.acceptRepo(programId, repoHash, true);

        // Maintainer opens an issue with AI-suggested base points (200 max).
        vm.prank(maintainer);
        uint256 issueId = waveIssue.createIssue(programId, repoHash, bytes32("spec"), 150, 2);

        // Open a wave so builders can claim.
        vm.prank(organizer);
        uint256 waveId = program.openWave(programId);

        // Builder claims and submits a PR.
        vm.prank(builderA);
        waveIssue.claimIssue(issueId);
        vm.prank(builderA);
        waveIssue.submitPr(issueId, bytes32("pr-diff"), 42);

        // Maintainer confirms the merge -> builder earns base points.
        vm.prank(maintainer);
        waveIssue.confirmMerge(issueId);
        assertEq(program.pointsLedger(programId).totalPoints(waveId), 150);

        // Advancement: close build -> eval, close eval, finalize.
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeWave(programId, waveId);
        vm.warp(block.timestamp + 2 days + 2);
        vm.prank(organizer);
        program.closeEvaluation(programId, waveId);
        vm.prank(organizer);
        program.finalizeWave(programId, waveId);

        uint256 budget = program.waveBudget(programId, waveId);
        assertEq(budget, genesis / 3);
        uint256 netBudget = program.totalClaimable(programId, waveId);
        // 100% of points to builderA → 100% of net budget.
        assertEq(program.claimableShare(programId, waveId, builderA), netBudget);

        uint256 bal0 = usdc.balanceOf(builderA);
        vm.prank(builderA);
        program.claim(programId, waveId);
        assertEq(usdc.balanceOf(builderA) - bal0, netBudget);
    }

    function test_WaveIssue_RepoNotAcceptedReverts() public {
        uint256 genesis = 300_000e6;
        uint256 programId = _deployProgram(genesis, IZeroLanceWaveProgram.BudgetMethod.FixedPerWave);
        vm.expectRevert(IZeroLanceWaveIssue.RepoNotAccepted.selector);
        vm.prank(maintainer);
        waveIssue.createIssue(programId, bytes32("unapproved"), bytes32("spec"), 150, 2);
    }

    function test_Buildathon_AdjacentWave_Budget() public {
        // PctOfRemaining mode: two waves, each gets half the pool.
        uint256 genesis = 200_000e6;
        uint256 programId = _deployProgram(genesis, IZeroLanceWaveProgram.BudgetMethod.PctOfRemaining);
        vm.prank(organizer);
        program.grantAwarder(programId, address(buildathon), true);

        vm.prank(organizer);
        uint256 w1 = program.openWave(programId);
        vm.prank(organizer);
        buildathon.registerTeam(programId, builderA, bytes32("repoA"));
        vm.prank(organizer);
        uint256 subA1 = buildathon.submit(programId, 0, bytes32("demoA1"), bytes32("repoA"));

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeWave(programId, w1);
        vm.prank(organizer);
        buildathon.setSubmissionPoints(programId, subA1, 100);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(organizer);
        program.closeEvaluation(programId, w1);
        vm.prank(organizer);
        program.finalizeWave(programId, w1);

        uint256 budget1 = program.waveBudget(programId, w1);
        // PctOfRemaining: with 3 waves and 1 finalized, slice = pool/2 (2 remaining incl. current).
        assertGt(budget1, 0);
    }
}