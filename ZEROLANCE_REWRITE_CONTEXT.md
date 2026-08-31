# Context for the ZeroLance wave/escrow rewrite

This is a one-shot context file. Read it, then go.

## Project
- Foundry workspace at `apps/contracts/`. Solidity ^0.8.20. OZ 5.0.2 upgradeable.
- Forge uses `src/` as source root. Test at `apps/contracts/test/`.
- OZ imports: `@openzeppelin/contracts/...` and `@openzeppelin/contracts-upgradeable/...`
- Existing storage helpers in `apps/contracts/src/libraries/TimelockManager.sol` and `Utils.sol`.
- Compiled artifacts get mirrored into `packages/config/src/abis/<name>.{ts,js,d.ts}` (hand-authored; see `packages/config/src/abis/zeroLanceWaveProgram.ts` for the readable-name pattern).

## Design (locked)
1. **WaveFundingEscrow** (UUPS upgradeable) — funds-only vault. Holds USDC for any wave program. Exposes only:
   - `initialize(admin, treasury, verifier)` (verifier = WaveFundingVerifier address; the only privileged caller)
   - `deposit(programId, amount)` — anyone deposits (program itself or organizer). Internal accounting: `pooled[programId] += amount; totalReceived += amount;`
   - `claim(programId, waveId, who, amount)` — ONLY callable by the verifier. Transfers USDC from this contract to `who`.
   - `emergencyWithdraw(programId, amount, to)` — onlyOwner
   - `pooled(programId)`, `distributed(programId)`, `waveBudget(programId, waveId)`, `setWaveBudget(programId, waveId, budget)` (verifier-only), views.
   - **No program/wave/project logic.**
   - Storage uses ERC-7201 namespaced location.

2. **WaveFundingVerifier** (UUPS upgradeable) — pure state + rules, no token custody. Owns programs, waves, projects, awarders, points. Calls escrow for budget locks and claims. Exposes:
   - `initialize(admin, escrow)`
   - `createWaveProgram(token, genesisPool, numWaves, buildWindow, evalWindow, complimentWindow, budgetMethod, feeBps, treasury, specHash) -> programId`
   - `depositPool(programId, amount)` — pulls token into escrow, increments pooled
   - `openWave(programId) -> waveId` (only organizer)
   - `closeWave(programId, waveId)` — only organizer, build → evaluation, sets evalEndAt
   - `openEvaluation(programId, waveId)` — explicit alias for clarity (or just same fn as closeWave + status change)
   - `closeEvaluation(programId, waveId)` — only organizer, evaluation → compliments-or-finalize
   - `finalizeWave(programId, waveId)` — locks budget. If FixedPerWave: budget = genesisPool / numWaves. If PctOfRemaining: budget = remainingPool / (numWaves - waveSeq + 1). Sets `netBudget = budget * (10000-feeBps)/10000`. Tells escrow `setWaveBudget`. Freezes PointsLedger.
   - `grantAwarder(programId, who, allowed)` — organizer-managed
   - `registerProject(programId, waveId, wallet, repoUrl) -> projectId` — stores full repoUrl as string + repoHash = keccak(bytes(repoUrl))
   - `setProjectPoints(programId, projectId, points)` — awarder or organizer
   - `awardBase / awardCompliment / awardCommunity(waveId, contributor, points, refHash)` — operators (wave program admin or mode contracts) → writes to PointsLedger
   - `claim(programId, waveId)` — caller claims their own share (uses PointsLedger.contributorPoints for the caller's wave; pulls from escrow)
   - `claimFor(programId, waveId, who)` — same but for any address (signer-gated via role; or just remove if not needed)
   - `closeProgram(programId)` — organizer can return remaining budget after last wave; calls escrow.emergencyWithdraw to organizer.
   - Views: `program`, `wave`, `project`, `waveProjects(programId, waveId)`, `waveCount(programId)`, `pointsLedger()`, `escrow()`, `remainingPool(programId)`, `waveBudget(programId, waveId)`, `totalClaimable(programId, waveId)`, `claimableShare(programId, waveId, who)`, `claimed(programId, waveId, who)`.
   - `BudgetMethod { FixedPerWave, PctOfRemaining }` enum
   - `WaveStatus { None, Open, Evaluation, Compliments, Finalized, Closed }`

3. **ZeroLanceOssWave** (UUPS upgradeable) — OSS mode operations. NO escrow, NO points ledger directly. Calls into `WaveFundingVerifier` for award paths.
   - `initialize(admin, verifier)`
   - `acceptRepo(programId, repoHash, allowed)` — organizer-only
   - `acceptedRepo(programId, repoHash) -> bool`
   - `createIssue(programId, repoHash, specHash, basePoints, complexity) -> issueId` — only accepted repos; only maintainer. AI-suggested basePoints capped 200.
   - `setIssuePoints(issueId, basePoints)` — maintainer can override before claim, capped 200.
   - `claimIssue(issueId)` — only if a wave is open in the program; assigns builder
   - `submitPr(issueId, deliverableHash, prNumber)` — only builder
   - `confirmMerge(issueId)` — only maintainer; calls verifier.awardBase(waveId, builder, basePoints, refHash) + verifier.awardCompliment for any bonus
   - `addCompliment(issueId, points)` — anyone? or maintainer-only? → keep maintainer-only
   - `issue(issueId) -> Issue`
   - Issue struct: { programId, waveId, maintainer, builder, specHash, repoHash, basePoints, bonusPoints, deliveredPr, deliverableHash, complexity, state, pointsAwarded }
   - IssueState: Created, Claimed, PrSubmitted, Awarded, Closed

4. **ZeroLanceBuildathonWave** (UUPS upgradeable) — buildathon mode. Same shape.
   - `initialize(admin, verifier)`
   - `registerTeam(programId, wallet, repoUrl) -> teamId` — only organizer (organizer is the one managing registration in the current code, but really should be open to any builder). **Decision**: keep organizer-only for now (matches existing behavior), but emit clearly.
   - `team(teamId) -> Team`
   - `submit(programId, teamId, contentHash, repoUrl) -> subId` — only team lead (or organizer)
   - `submission(subId) -> Submission`
   - `setSubmissionPoints(programId, subId, points)` — awarder or organizer; calls verifier.awardBase
   - `castVote(subId, points)` — community vote path; calls verifier.awardCommunity
   - Submission struct: { programId, waveId, teamId, contentHash, repoHash, points }

5. **ZeroLanceTaskEscrow** (REPLACES `ZeroLanceEscrowVault`) — funds only.
   - `initialize(admin, verifier)` — verifier = TaskVerifier (the only privileged caller)
   - `deposit(taskId, amount)` — client only (caller must be the task's client; needs TaskRegistry view)
   - `release(taskId, freelancer, feeBps, treasury)` — ONLY verifier; pays freelancer + fee
   - `refund(taskId)` — client only, only if status == Open
   - `resolveDispute(taskId, winner)` — ONLY verifier (or arbitration)
   - `setTaskRegistry(address)` — owner
   - `escrowedOf(taskId)`, `releasedOf(taskId)`, `protocolTreasury()`, `protocolFeeBps()`, `verifier()`
   - **REMOVES**: `submitDeliverable`, `submitVerdict`, `escalateDispute`, `mintReputationForTask`, `mintReputation` (relocated)

6. **ZeroLanceTaskVerifier** (NEW) — task lifecycle: deliverable + verdict + dispute escalation + reputation minting.
   - `initialize(admin, registry, escrow, teeVerifier, reputationNft, arbitration)`
   - `submitDeliverable(taskId, deliverableHash, prNumber)` — only freelancer
   - `submitVerdict(Verdict calldata verdict)` — verifies EIP-712 via teeVerifier; if passed calls escrow.release; if failed sets dispute state
   - `escalateDispute(taskId, arbiters)` — anyone after retry window; opens arbitration dispute
   - `mintReputationForTask(taskId, description, dataHash)` — owner (operator) gated; mints NFT
   - Uses teeVerifier.verifyVerdict, registry.taskOf, escrow.release/resolveDispute, arbitration.openDispute

7. **Existing files to DELETE** (do not just trim — the user wants a clean project):
   - `apps/contracts/src/zerolancewave/ZeroLanceWaveProgram.sol` and `IZeroLanceWaveProgram.sol` (replaced by WaveFundingVerifier + WaveFundingEscrow)
   - `apps/contracts/src/zerolancewave/ZeroLanceWaveIssue.sol` and `IZeroLanceWaveIssue.sol` (replaced by ZeroLanceOssWave)
   - `apps/contracts/src/zerolancewave/ZeroLanceWaveBuildathon.sol` and `IZeroLanceWaveBuildathon.sol` (replaced by ZeroLanceBuildathonWave)
   - `apps/contracts/src/ZeroLanceEscrowVault.sol` and `IZeroLanceEscrowVault.sol` (replaced by TaskEscrow + TaskVerifier)
   - `apps/contracts/src/interfaces/IZeroLanceEscrowVault.sol`
   - The other interface files are still used (keep).

8. **KEEP unchanged**: `ZeroLanceTaskRegistry.sol`, `ZeroLanceArbitration.sol`, `ZeroLanceReputationNFT.sol`, `ZeroLanceTeeVerifier.sol`, `ZeroLanceToken.sol`, `MockUSDC.sol`, `ERC7857Upgradeable.sol`, `verifiers/BaseVerifier.sol`, `verifiers/ZeroLanceTeeVerifier.sol`, `libraries/TimelockManager.sol`, `libraries/Utils.sol`, `zerolancewave/PointsLedger.sol`, `zerolancewave/IPointsLedger.sol`.

## Existing artifacts to mirror
- ABI files: `packages/config/src/abis/zeroLanceWaveProgram.ts` is a hand-readable-name ABI. Pattern: `export const FOO_ABI = [...] as const;` then re-export. Each contract has `.ts`, `.js`, `.d.ts`, `.js.map`, `.d.ts.map`. Re-generate the .ts files at minimum; .js/.d.ts can be regenerated by `cd packages/config && npx tsc` if you set the file to just `export * from "./foo";`.
- Index file: `packages/config/src/abis/index.ts` re-exports the named ABI constants.
- Deploy scripts: `apps/contracts/script/DeployWave.s.sol` and `Deploy.s.sol`. Update DeployWave to deploy WaveFundingEscrow + WaveFundingVerifier + ZeroLanceOssWave + ZeroLanceBuildathonWave (4 contracts). Update Deploy.s.sol to deploy TaskEscrow + TaskVerifier (replacing EscrowVault).
- Tests: rewrite `apps/contracts/test/WaveFunding.t.sol` and `apps/contracts/test/EscrowFlow.t.sol` against the new contracts.
- Backend `WaveClient` (`apps/backend/src/wave/client.ts`) — split into two: `WaveEscrowClient` (deposit/claim/emergency) and `WaveVerifierClient` (program/wave/project/points). Plus `OssWaveClient` and `BuildathonWaveClient` for the mode-specific actions.
- Backend `routers/wave.ts` — keep routes but use the new client methods. Add a `waveCount` view route. The `claim` route becomes `POST /v1/wave/program/:id/claim { waveId }` and uses the caller's own address.
- Server wiring: `apps/backend/src/server.ts` — replace `waveClient` with the four clients, gated on env vars.
- Env: add `ZERO_WAVE_ESCROW_ADDRESS`, `ZERO_WAVE_VERIFIER_ADDRESS`, `ZERO_OSS_WAVE_ADDRESS`, `ZERO_BUILDATHON_WAVE_ADDRESS`, `ZERO_TASK_ESCROW_ADDRESS`, `ZERO_TASK_VERIFIER_ADDRESS`. Keep `ZERO_WAVE_PROGRAM_ADDRESS` etc. as deprecated aliases for the deploy manifest's old names if needed — or just rename.

## Constraints
- Use UUPS + ERC-7201 for upgradeable. Disable initializers in constructor. `__gap` arrays sized to fit 50 slots.
- Use `using SafeERC20 for IERC20`.
- All public/external state-changing functions: `nonReentrant` where they touch funds; `whenNotPaused` where a Pausable base is included.
- CEI: state before transfer.
- Errors: declare in interfaces where possible.
- Events: index heavy-hitter fields.
- No comments in code per project rules (one-line doc comments on `/// @title`/`/// @notice` are OK and conventional — keep them).
- Keep code under ~300 lines per file. Split helpers into a `libraries/` if needed.
- BigInt/uint256 math: avoid overflow. Cap basePoints to 200 in OSS issue creation.

## Tooling
- `forge build` and `forge test` from `apps/contracts/`.
- `pnpm build` at the repo root runs `forge build` then generates ABIs in `packages/config`.
- `npx tsc -b packages/config apps/backend` for type-checking.

## Subagent split
- **Agent A (write new Solidity)**: implements the 6 new contracts + their interfaces.
- **Agent B (tests)**: writes/rewrites `WaveFunding.t.sol` and `EscrowFlow.t.sol` against the new API.
- **Agent C (backend wiring)**: rewrites `WaveClient`, `routers/wave.ts`, `server.ts`, and the `packages/config/src/abis/` files.
- **Agent D (cleanup + deploy)**: deletes the old contracts/files, rewrites `DeployWave.s.sol` and `Deploy.s.sol`, updates `packages/config/src/networks.ts` and `index.ts` and the docs.
- **Final agent (verify)**: run `forge build && forge test` from `apps/contracts/`. Run `npx tsc -b packages/config apps/backend` from repo root. Fix any breakage.
