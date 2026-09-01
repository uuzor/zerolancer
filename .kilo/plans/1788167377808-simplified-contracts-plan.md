# Simplified Contracts Plan — 3 styles, 2 contracts

## Goal
Each contract does **one thing**: escrow (hold funds) or verification (authorize release). All state machines (builders, issues, teams, disputes) live in the backend DB. Contracts are dumb payout routers.

## Three product styles

| Style | Who interacts | What they do | On-chain state |
|---|---|---|---|
| **1. Task escrow** | Client + freelancer | Client posts task, freelancer does work, AI verdict releases escrow | taskId → escrowed amount, released flag |
| **2. Wave OSS** | Organiser + maintainers + builders | Organiser approves repos, maintainers create issues, builders submit PRs, points awarded on merge, wave budget split pro-rata | waveId → builder → points, budget |
| **3. Wave Buildathon** | Organiser + builders | Organiser sets program + wave count, builders register projects (wallet + repoUrl), organiser assigns points per wave, wave budget split pro-rata | waveId → builder → points, budget |

## New contracts (2 total)

### `ZeroLanceTaskEscrow` — task escrow + AI verification
- `initialize(admin, registry, treasury, teeVerifier, reputationNft, signer)`
- `deposit(taskId, amount)` — client only
- `submitVerdict(verdict)` — verifies EIP-712 via teeVerifier; passed → release; failed → sets Disputed
- `release(taskId, freelancer, feeBps, treasury)` — signer-only (backend)
- `refund(taskId)` — client only (Open)
- `resolveDispute(taskId, winner)` — signer-only (backend DB decides)
- `mintReputation(taskId, description, dataHash)` — signer-only
- Views: `escrowed`, `released`

### `WaveFundingVault` — wave escrow + points + distribution (replaces 3 old contracts)
- `initialize(admin, treasury, signer)`
- `createProgram(token, genesisPool, numWaves, feeBps, treasury, specHash)` → programId (organiser)
- `deposit(programId, amount)` — anyone
- `openWave(programId)` → waveId (organiser)
- `closeWave(programId, waveId)` (organiser)
- `finalizeWave(programId, waveId)` — locks budget (organiser)
- `setPoints(waveId, builder, points)` — signer-only (backend)
- `claim(waveId, builder)` — anyone; computes `(budget * builderPoints) / totalWavePoints`
- `resolveDispute(taskId, winner)` — signer-only (task dispute, if any)
- `emergencyWithdraw(programId, to, amount)` — owner
- Views: `program`, `wave`, `waveCount`, `builderPoints`, `totalWavePoints`, `claimableShare`, `pooled`, `distributed`

**Distribution formula:**
```
share = (budget * builderPoints[waveId][builder]) / totalWavePoints[waveId]
```
Budget locked at `finalizeWave`. `netBudget = budget * (10000 - feeBps) / 10000`.

### Keep unchanged
- `ZeroLanceTaskRegistry` — immutable task specs (on-chain)
- `ZeroLanceTeeVerifier` — EIP-712 verification (on-chain)
- `ZeroLanceReputationNFT` — reputation receipts (on-chain)
- `ZeroLanceToken` — $ZERO token (on-chain)
- `MockUSDC` — test token

### Delete entirely
- `ZeroLanceArbitration` — dispute resolution moves to DB + backend signer
- `PointsLedger` — absorbed into WaveFundingVault
- `ZeroLanceOssWave` — all OSS state moves to DB
- `ZeroLanceBuildathonWave` — all buildathon state moves to DB
- `ZeroLanceWaveProgram`, `IZeroLanceWaveProgram` — replaced by WaveFundingVault
- `IZeroLanceWaveIssue`, `IZeroLanceWaveBuildathon` — replaced by DB
- `ZeroLanceEscrowVault`, `IZeroLanceEscrowVault.sol` — replaced by ZeroLanceTaskEscrow
- `IZeroLanceArbitration.sol` — replaced by signer-gated resolve
- `IZeroLanceTaskRegistry.sol` — KEEP (still used)
- `IZeroLanceTeeVerifier.sol` — KEEP (still used)
- `IZeroLanceReputationNFT.sol` — KEEP (still used)

## Backend DB (source of truth for all state)

### Existing tables (keep)
- `tasks` — task lifecycle
- `wave_programs` — program metadata
- `wave_waves` — per-wave state
- `wave_projects` — project records (buildathon)
- `wave_builders` — builder profiles
- `wave_points` — points history
- `oss_repos` — approved repos
- `oss_issues` — issue lifecycle

### Backend responsibilities (same for all 3 styles)
1. **State machines**: all lifecycle (open/close/finalize, approve repos, create issues, register teams, claim issues, submit PRs, confirm merges) lives in DB
2. **Points authority**: backend signer calls `setPoints(waveId, builder, points)` on WaveFundingVault
3. **Distribution**: compute claimable shares from DB, call `claim(waveId, builder)` or let builders call it directly
4. **Dispute resolution**: manage arbiter voting in DB, call `resolveDispute(taskId, winner)` on ZeroLanceTaskEscrow
5. **Verification pipeline**: AI verdict → `submitVerdict` on ZeroLanceTaskEscrow; merge confirmation → `setPoints` on WaveFundingVault

### Trust model
- Backend signer is trusted for: points updates, dispute resolution payouts, verdict submission
- Organiser is trusted for: program/wave/task lifecycle
- Anyone can call `claim` — trustless distribution
- Budget is locked at `finalizeWave` — signer can't extract more than the pool

## DB schema changes

### New tables
| Table | Purpose |
|---|---|
| `wave_programs` | `(programId, organiser, token, treasury, feeBps, numWaves, budgetMethod, description, specHash, createdAt)` |
| `wave_waves` | `(waveId, programId, waveSeq, buildEndAt, evalEndAt, status, budget, finalized, createdAt)` |
| `wave_builder_points` | `(waveId, builder, points, updatedAt)` — source of truth for points |
| `wave_claims` | `(waveId, builder, claimedAt, txHash)` |
| `oss_repos` | `(programId, repoHash, repoUrl, approved, approvedAt, approvedBy)` |
| `oss_issues` | `(issueId, programId, repoHash, maintainer, specHash, basePoints, complexity, state, builder, deliverableHash, prNumber, mergedAt)` |
| `buildathon_teams` | `(teamId, programId, wallet, repoUrl, repoHash, name, createdAt)` |
| `buildathon_submissions` | `(subId, programId, teamId, waveId, contentHash, repoHash, points, state)` |
| `disputes` | `(taskId, status, votes, winner, resolvedAt)` |

### Removed tables
- None (existing wave DB tables in `waveStore.ts` already cover most of this; just add missing ones)

## Implementation order
1. Write `WaveFundingVault.sol` + `IWaveFundingVault.sol` (single wave contract)
2. Write simplified `ZeroLanceTaskEscrow.sol` + `IZeroLanceTaskEscrow.sol`
3. Delete old contracts (7 files)
4. Update deploy scripts (`DeployWave.s.sol`, `Deploy.s.sol`)
5. Update backend DB schema (if needed), clients, routers
6. Update ABIs in `packages/config/src/abis/`
7. Rewrite tests (`WaveFunding.t.sol`, `EscrowFlow.t.sol`)
8. Verify: forge build, forge test, tsc

## Risks
1. **Signer trust**: backend key can redistribute points within a wave's budget. Mitigated by organiser audit before finalize.
2. **Single point of failure**: backend manages all state. Acceptable for MVP; can add merkle proofs in Phase 2.
3. **Reorg / state drift**: DB and contract can diverge if sync fails. Mitigated by idempotent sync with DB as source of truth.
