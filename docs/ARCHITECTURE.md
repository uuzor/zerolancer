# ZeroLance — Architecture & Design

> **ZeroLance**: Permissionless Freelance Escrow & Dispute Resolution on 0G.
> Replaces Upwork's 20% fees and opaque disputes with AI-verified escrow,
> GitHub-native workflows, and on-chain reputation.

This document maps the **axiom-protocol** reference patterns onto the ZeroLance
feature set and defines the monorepo structure, contract set, and service
responsibilities.

---

## 1. Monorepo structure

Mirrors axiom-protocol's pnpm workspace layout, specialized for a freelance
marketplace:

```
zerolancer/
├── apps/
│   ├── contracts/        # Foundry: Solidity contracts (ZeroLance protocol)
│   ├── backend/          # Express API + indexer + AI verdict orchestrator + GitHub runner
│   ├── oracle/           # TEE signer: signs AI verdicts + re-keys ERC-7857 reputation metadata
│   └── frontend/         # Vite + React + wagmi: marketplace dashboard
├── packages/
│   ├── config/           # Shared: networks, addresses, ABIs, EIP-712, crypto, 0G Storage, env, auth
│   └── shared/           # Shared types: task, verdict, dispute, reputation domain models
├── docs/                 # Architecture (this), deployments, runbooks
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Package scope: `@zerolance/{config,shared,contracts,backend,oracle,frontend}`.

---

## 2. Feature → axiom-protocol pattern mapping

| ZeroLance feature | axiom pattern reused | ZeroLance artifact |
|---|---|---|
| 1. AI-Verified Escrow | `AxiomStrategyVault` (per-token vault, Merkle-verified execute) + `AxiomPaymentProcessor` (ERC-20 fee split) | `ZeroLanceTaskEscrow` (funds-only USDC vault) + `ZeroLanceTaskVerifier` (deliverable + verdict + dispute + reputation) |
| 2. GitHub-Native Workflows | Oracle EIP-712 signing + backend orchestrator (0G Compute inference) | `GitHubRunner` service + `ZeroLanceTeeVerifier` verdict signatures |
| 3. Multi-Sig Dispute Arbitration | Timelock + on-chain voting patterns | `ZeroLanceArbitration` (arbiter multi-sig voting, $ZERO rewards, 2-week retry window) |
| 4. Immutable Task Specs | 0G Storage adapter + on-chain `dataHash` | `ZeroLanceTaskRegistry` (spec hash committed on-chain, immutable after creation) |
| 5. Portable Reputation (ERC-7857) | `AxiomAgentNFT` (ERC-7857 iNFT, TEE re-keying) | `ZeroLanceReputationNFT` (NFT receipt per task, portfolio metadata, verified badge via staking) |
| 6. Streaming Escrow | `AxiomStrategyVault` milestone/execute model | Out of MVP (single-release only); `ZeroLanceTaskEscrow` designed to be extended with a streaming/milestone module behind the verifier. |
| 7. Marketplace Dashboard | `@axiom/frontend` (Vite+React+wagmi) | `@zerolance/frontend` (tasks, creation, verification status, dispute UI) |
| 8. Token Economics ($ZERO) | — (new) | `ZeroLanceToken` (governance, arbiter rewards, staking, task boosting/burn) |
| Verifier trust anchor | `AxiomTeeVerifier` (EIP-712 proof verification) | `ZeroLanceTeeVerifier` (verifies AI verdicts + ERC-7857 transfers) |

---

## 3. Smart contracts (`apps/contracts`)

Foundry, Solidity `^0.8.20`, OpenZeppelin 5.0.2 (upgradeable UUPS), ERC-7201
namespaced storage, 1-day timelocks on sensitive rotations, CEI + reentrancy
guards, SafeERC20. 0G Chain (Cancun EVM, zero gas).

### 3.1 `ZeroLanceTaskRegistry`
- Client creates a task: spec (encrypted) uploaded to 0G Storage → `specHash`
  committed on-chain. **Immutable after creation** (no setter for specHash).
- Stores: client, freelancer (assigned), deadline, reward amount, payment token,
  verification config (test thresholds, coverage gates), status enum
  (`Open → Assigned → InReview → Passed → Disputed → Resolved → Cancelled`).
- Emits `TaskCreated`, `TaskAssigned`, `DeliverableSubmitted`, `VerdictSubmitted`,
  `TaskResolved`.
- GitHub linkage: stores `repoUrl`, `issueNumber`, `prNumber` (immutable
  alongside specHash).

### 3.2 `ZeroLanceTaskEscrow` + `ZeroLanceTaskVerifier`
Adapted from `AxiomStrategyVault` (ERC-20 instead of native) +
`AxiomPaymentProcessor` fee split. The monolithic `ZeroLanceEscrowVault` was
split into two contracts so each does exactly one thing:

**`ZeroLanceTaskEscrow` — funds-only vault.** Holds USDC for any task, tracks
per-task accounting, and exposes only the money-moving surface. It owns no
business logic.

- `deposit(taskId, amount)` — task client only; pulls USDC via `safeTransferFrom`.
- `release(taskId, freelancer, feeBps, treasury)` — **TaskVerifier-only**;
  pays `freelancer = amount * (1 - feeBps/10000)` and `treasury = amount * feeBps/10000`.
- `refund(taskId)` — client only, only when status is `Open`.
- `resolveDispute(taskId, winner)` — **TaskVerifier-only** (or arbitration via
  low-level call); full escrow pays winner with 0 fee.
- Views: `escrowedOf`, `releasedOf`, `protocolFeeBps`, `protocolTreasury`,
  `verifier`.

**`ZeroLanceTaskVerifier` — task lifecycle orchestrator.** No token custody.

- `submitDeliverable(taskId, deliverableHash, prNumber)` — only freelancer.
- `submitVerdict(Verdict calldata verdict)` — verifies the EIP-712 signature
  via `ZeroLanceTeeVerifier`; if `passed` calls `escrow.release`; if `failed`
  records dispute state and (after 14-day retry window) opens arbitration.
- `escalateDispute(taskId, arbiters)` — anyone after retry window; opens
  arbiter panel.
- `mintReputationForTask(taskId, description, dataHash)` — owner-gated;
  mints the ERC-7857 NFT.

The split keeps the escrow's attack surface to "move money" while keeping the
verifier's surface to "decide what to do". Any privileged escrow action must
go through the verifier — the escrow trusts nothing else.

### 3.2a Wave funding split (escrow + verifier + two mode contracts)
The monolithic `ZeroLanceWaveProgram` + `ZeroLanceWaveIssue` +
`ZeroLanceWaveBuildathon` triplet was rewritten into five contracts, each
doing one thing. Wave funding has two operating modes that share the same
funding + points infrastructure:

- **OSS mode** — maintainer posts paid GitHub issues inside an accepted
  repo; builders claim, submit PRs, and earn base + compliment points.
- **Buildathon mode** — teams register and submit per-wave projects;
  scoring is split between whitelisted judges (base points) and community
  voters (community points).

Both modes plug into the same escrow + verifier + ledger, so they share
funding, points accounting, and wave lifecycle.

| Contract | Responsibility |
|---|---|
| `WaveFundingEscrow` | Funds-only vault. Holds USDC, tracks `pooled` / `distributed` / `waveBudget` per program. **The verifier is the only privileged caller.** |
| `WaveFundingVerifier` | State + rules. Owns programs, waves, projects, awarders, points. Calls the escrow for budget locks and claim payouts. **No token custody.** |
| `ZeroLanceOssWave` | OSS mode operations (accept repo, create/claim/submit/merge issues). Routes awards through `WaveFundingVerifier`. |
| `ZeroLanceBuildathonWave` | Buildathon mode operations (register team, submit, judge + community scoring). Routes awards through `WaveFundingVerifier`. |
| `PointsLedger` | Non-upgradeable, shared points accounting per wave. Frozen at wave close. Owned by the verifier. |

Trust direction is strict: **mode contracts → verifier → escrow**. Mode
contracts can only award points via the verifier; the verifier is the only
caller allowed to move money in the escrow; the escrow never talks back
except via events.

### 3.3 `ZeroLanceArbitration`
- New. Triggered when AI verdict = failed and retry window (2 weeks) elapses,
  or client disputes.
- Multi-sig of arbiters (other staked freelancers) vote on-chain:
  `vote(taskId, winner)`.
- Quorum + majority → winner takes escrow; arbiters earn `$ZERO` rewards.
- Arbiter selection: staked `ZeroLanceReputationNFT` holders, randomized per
  dispute, slashable for collusion (griefing/dishonesty).

### 3.4 `ZeroLanceReputationNFT`
Adapted from `AxiomAgentNFT` (ERC-7857 iNFT).
- Minted as a receipt NFT on each completed task (freelancer is owner).
- On-chain metadata: portfolio (completed task IDs + encrypted reviews) via
  `intelligentDatasOf` (ERC-7857 IDataStorage extension).
- Encrypted metadata re-keyed on transfer via TEE (portable identity if the
  platform dies — ERC-7857 TEE re-keying).
- **Verified badge**: freelancers stake `$ZERO` for higher task visibility
  (stake amount tracked, slashable).
- Composes `ERC7857Cloneable` + `ERC7857Authorize` + `ERC7857IDataStorage`.

### 3.5 `ZeroLanceToken` ($ZERO)
- ERC-20 governance token (OZ ERC20Upgradeable, UUPS).
- **Governance**: holders vote on protocol upgrades, fee adjustments (via
  `ZeroLanceGovernor`, Phase 2).
- **Arbiter rewards**: minted/transferred to arbiters on dispute resolution.
- **Staking**: freelancers stake for verified badge.
- **Task boosting**: clients burn `$ZERO` to boost urgent/high-value tasks
  (queue priority).

### 3.6 `ZeroLanceTeeVerifier`
Adapted from `AxiomTeeVerifier`.
- Verifies EIP-712 signed **AI verdicts** (verdict struct: taskId, deliverableHash,
  verdict bool, score, signature) — the trust anchor for auto-release.
- Also fulfills the ERC-7857 `IERC7857DataVerifier` role for reputation NFT
  transfers (re-keying proofs).
- Replay protection (`usedProofs`), `validUntil` deadlines, signer rotation
  timelock.

### 3.7 `MockUSDC`
- ERC-20 payment token for testnet/devnet escrow.

### Shared libraries
- `TimelockManager` (1-day propose→execute, copied from axiom).
- `ERC7857Upgradeable` + 3 extensions + `IERC7857*` interfaces (adapted from axiom
  / 0G reference, MIT).
- `ZeroLanceMetadataJson` (OpenSea-compatible JSON view, adapted from
  `AxiomMetadataJson`).

---

## 4. Backend (`apps/backend`)

Express + ethers + ws + zod. Reuses axiom's route factory, indexer, orchestrator,
auth, and event-store patterns.

### Routers
- `tasks` — create/assign/list tasks, submit deliverable, poll verification status.
- `escrow` — deposit/withdraw encoding, streaming config, release status.
- `disputes` — open dispute, vote counter, arbiter assignment.
- `reputation` — list reputation NFTs, portfolio, verified-badge stake.
- `verification` — submit deliverable for AI verdict, stream verdict.
- `events` — indexed on-chain event timeline (WS stream).
- `health`, `routes` (meta).

### Services
- **`GitHubRunner`** (new): clones the task's repo, checks out the PR branch,
  runs CI/CD (unit tests, linting, coverage) in a sandbox; collects results.
  Mirrors axiom's `StrategyRunner` shape (async pipeline, onchain settle) but
  the "inference" is deterministic CI + AI scoring.
- **`VerdictOrchestrator`** (adapted `StrategyRunner`): runs the verification
  pipeline (code: CI gates; design: ML brand compliance; content: LLM similarity),
  produces a signed verdict, submits `submitVerdict` on-chain via the oracle.
- **`Indexer`** (adapted): polling, reorg-safe checkpoints, `EventStore`
  (persisted JSON, in-memory indexes, dedupe, WS broadcast).
- **`OracleClient`** (adapted): HTTP client to oracle for verdict signing +
  ERC-7857 transfer-validity.
- **`EscrowClient`** / **`ReputationClient`**: typed contract wrappers (adapted
  `PaymentProcessorClient`).
- **`ComputeClient`**: 0G Compute router (OpenAI SDK) for AI scoring.
- **Auth**: API-key (server/client split), path allowlist, timing-safe (copied).
- **WS broadcaster**: topic-filtered (tasks, disputes, events), heartbeat.

### Verification pipeline (feature 1 & 2)
```
freelancer submits PR
  → GitHubRunner: clone repo, checkout PR branch, run CI in sandbox
  → VerdictOrchestrator: gather (tests, lint, coverage) + AI scoring (0G Compute)
  → oracle signs verdict (EIP-712) via ZeroLanceTeeVerifier
  → backend submits submitVerdict(taskId, verdict, signature) on-chain
  → ZeroLanceEscrowVault auto-releases USDC if verdict = passed (2–3% fee)
```

---

## 5. Oracle (`apps/oracle`)

Express TEE signer service (adapted from axiom oracle).
- `TeeSigner`: secp256k1 keypair, EIP-712 signing for **verdicts** and
  ERC-7857 ownership proofs.
- `StorageAdapter`: 0G Storage (encrypted task specs, deliverables, audit trail)
  or InMemory for dev.
- Re-keys encrypted reputation metadata on NFT transfer (download → decrypt →
  re-encrypt → upload → seal key for receiver).
- Marks seen dataHashes (replay/integrity).
- Simulated TEE today (Node signer); Intel TDX/SEV in production.

---

## 6. Frontend (`apps/frontend`)

Vite + React 18 + wagmi v2 + RainbowKit v2 + TanStack Query (same stack as axiom).
- **Task marketplace**: open tasks list (sortable by deadline/pay/difficulty),
  task creation form (spec builder with test config + coverage gates).
- **Real-time verification status**: poll/stream AI verdict.
- **Dispute resolution UI**: multi-sig vote counter.
- **Reputation profile**: portfolio NFTs, verified badge, stake management.
- **Streaming escrow**: retainer setup, weekly milestone status.

---

## 7. 0G integration (cross-layer)

- **0G Chain** — all contracts deployed/executed (escrow, arbitration,
  reputation NFT, token, verifier).
- **0G Compute** — AI verification inference (code scoring, design ML, content
  LLM similarity) + the simulated-TEE signer.
- **0G Storage** — encrypted task specs (immutable), deliverables, PR diffs,
  test results, dispute comments; Merkle `dataHash` registered on-chain.

---

## 8. Go-to-market phasing (build order)

- **Phase 1** (MVP, contracts + backend + GitHub code tasks): `ZeroLanceTaskRegistry`,
  `ZeroLanceTaskEscrow`, `ZeroLanceTaskVerifier`, `ZeroLanceTeeVerifier`, `ZeroLanceReputationNFT`,
  `WaveFundingEscrow`, `WaveFundingVerifier`, `ZeroLanceOssWave`, `ZeroLanceBuildathonWave`,
  `PointsLedger`, `MockUSDC`, backend GitHub runner + verdict orchestrator + indexer, frontend
  marketplace. Lowest dispute risk: GitHub-backed code tasks.
- **Phase 2** (token + disputes): `ZeroLanceToken` ($ZERO), `ZeroLanceArbitration`,
  arbiter staking/rewards, verified-badge staking, task boosting.
- **Phase 3** (horizontal expansion): design tasks (ML image verification),
  content tasks (LLM similarity), community tasks (hybrid AI + community voting),
  streaming escrow retainers.
