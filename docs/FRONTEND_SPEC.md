# ZeroLance — Frontend Specification

> **Scope:** End-to-end frontend product spec derived from the current backend (Express + WebSocket) and on-chain contracts (Solana-style escrow, arbitration, reputation NFTs, wave funding) deployed to 0G Galileo testnet.
> **Stack (assumed):** Vite + React + TypeScript + wagmi + RainbowKit + viem + react-router-dom (already in `apps/frontend/package.json`).
> **Source of truth:** `apps/backend/src/routers/*.ts`, `apps/contracts/src/**/*.sol`, `docs/deployments/galileo.json`, `apps/frontend/src/AppShell.tsx`.

---

## 0. TL;DR — What ZeroLance is

ZeroLance is a **decentralized freelance marketplace on 0G Chain** that pays builders from on-chain escrow only after an **AI-scored + CI-verified + oracle-signed verdict** passes. The platform supports three top-level product surfaces:

1. **Task Marketplace** — A client posts a paid task; a freelancer does the work; an oracle releases escrow. Disputes go to a staked-NFT arbiter panel.
2. **Wave Funding (Programs / Issues / Buildathons)** — A program organizer deposits a reward pool, runs sequential waves, and distributes funds proportionally to points that awarders, maintainers, judges, or community voters assign. There are three sub-modes:
   - **Program** — generic reward pool with weighted points per wave.
   - **Issue** — maintainer creates GitHub-style issues inside an accepted repo; builders claim, submit PRs, get merged, earn base + compliment points.
   - **Buildathon** — teams register, submit per wave, judges and community award points.
3. **Reputation** — every completed task mints an **ERC-7857 intelligent NFT** with encrypted portfolio metadata anchored to 0G Storage. Staking 1 $ZERO gets a "Verified" badge that boostraps trust.

The frontend must support two distinct personas end-to-end:

- **Maintainer / Client** — posts work, funds escrow, reviews deliverables, escalates disputes, runs a wave program.
- **Builder / Freelancer** — claims tasks/issues, submits PRs, votes on buildathons, earns USDC and reputation.

---

## 1. Personas

### 1.1 Maintainer / Client
- Has a GitHub repo and a USDC balance on 0G.
- Wants to: post a paid task, attach it to a GitHub issue, fund escrow, review submissions, run a wave program (issues or buildathons), award points, finalize waves, distribute funds.

### 1.2 Builder / Freelancer
- Has a wallet, optional GitHub account, and 0G storage access.
- Wants to: browse the marketplace, claim a task/issue, submit a PR, watch the AI+CI verification pipeline run, see escrow release, build reputation, claim wave rewards.

### 1.3 Arbiter (secondary persona — dispute only)
- A `MINTER_ROLE` holder on the reputation NFT (typically a staked, completed-task holder).
- Receives dispute invitations; casts Client/Freelancer/Abstain votes; earns arbiter rewards or gets slashed for collusion.

### 1.4 Wave Organizer (sub-persona of Maintainer)
- Has USDC and wants to run a multi-wave funding program.
- Wants to: create program, deposit pool, open/close waves, grant awarder/judge roles, finalize, observe auto-distribution.

---

## 2. Authentication & Wallet

ZeroLance uses **two parallel auth layers**, both required for full functionality:

### 2.1 Wallet Auth (on-chain) — `wagmi` + `RainbowKit`
- Connect via RainbowKit on 0G Galileo testnet (chainId `16602`).
- All write endpoints return **unsigned calldata** that the connected wallet must sign and submit. The frontend is responsible for broadcasting every transaction except `submitVerdict` (which the backend signs itself).
- Wallet is the source of identity for everything on-chain: tasks, escrow, reputation, waves.

### 2.2 Backend Auth — `X-Api-Key` header
- `ZERO_API_KEY` (server) — full access, used by the backend's own signer for `submitVerdict` and signer-gated wave writes.
- `ZERO_CLIENT_API_KEY` (browser) — restricted to a path allowlist; intended for the frontend.
- In dev (`ZERO_DISABLE_AUTH=true`) all requests pass with `authPrincipal = "disabled"`. The frontend should still attach the key when available.

### 2.3 GitHub Auth — OAuth via backend
- For any GitHub API action, the user must complete OAuth:
  - Frontend redirects to `GET /v1/github/auth/start?redirect=<callback-url>`.
  - GitHub hits `GET /v1/github/auth/callback?code=…&state=…`.
  - Backend stores the user in `GithubStore` and 302-redirects back to `<redirect>?login=<login>`.
  - The browser must store the **GitHub access token** (returned by a `/v1/github/me`-style call) and send it as `Authorization: Bearer <token>` on every subsequent `/v1/github/*` call.
- For server-to-server use (CI, automation), `ZERO_GITHUB_TOKEN` PAT is used by the backend when the Bearer matches `ZERO_API_KEY` / `ZERO_CLIENT_API_KEY`.

### 2.4 Auth page (`/login`)
- **Public landing** showing: brand, tagline, value prop, three CTAs ("Connect Wallet", "Connect GitHub", "Browse Marketplace").
- On wallet connect: derive ENS-like display name (truncated address) + avatar from RainbowKit; persist in local storage.
- On GitHub OAuth success (return to `/login?login=...&connected=1`): show toast "GitHub connected as <login>".
- If `authPrincipal === "disabled"` (dev), surface a yellow dev-mode banner.

### 2.5 Auth state model
```
type AuthState = {
  wallet: { address: `0x${string}`; chainId: number; connected: boolean } | null;
  github: { login: string; token: string; avatarUrl: string } | null;
  principal: "disabled" | "client" | "server" | null; // from /v1/config + headers
  apiKey: string | null; // ZERO_CLIENT_API_KEY in browser
};
```

---

## 3. Global App Shell

Extends existing `apps/frontend/src/AppShell.tsx` (header + nav + wallet slot + footer).

### 3.1 Navigation (post-login)
- **Marketplace** (`/marketplace`) — browse open tasks + wave programs.
- **My Tasks** (`/tasks`) — client-side: posted tasks; builder-side: assigned/claimed tasks.
- **Issues** (`/issues`) — wave-issue mode (builders + maintainers).
- **Buildathons** (`/buildathons`) — wave-buildathon mode.
- **Programs** (`/programs`) — program organizer dashboard.
- **Reputation** (`/reputation/:address?`) — NFTs, badges, stake.
- **Disputes** (`/disputes`) — open + closed disputes (for arbiters + parties).
- **GitHub** (`/github`) — link a GitHub account, view connected repos.
- **Settings** (`/settings`) — API key, theme, dev-mode banner toggle.

### 3.2 Wallet slot
- RainbowKit `ConnectButton` (already in shell).
- On connect, also show a small pill with the **active principal** ("client" / "disabled") for debugging.

### 3.3 Network guard
- If wallet is on wrong chain, show full-width banner: "Switch to 0G Galileo (chain 16602)" with a "Switch Network" button calling `wagmi.switchChain`.

---

## 4. Information Architecture (sitemap)

```
/                                    Landing (public)
/login                               Auth (wallet + GitHub)
/marketplace                         Browse all open work
  /marketplace/tasks                 Open tasks (paid, escrow-backed)
  /marketplace/waves                 Active wave programs (issue + buildathon + generic)
  /marketplace/tasks/:taskId         Task detail (public read)
  /marketplace/waves/:programId      Program detail
  /marketplace/waves/:programId/wave/:waveId  Wave detail

/tasks                               My tasks dashboard (role-aware tabs)
  /tasks/new                         Create new task (maintainer)
  /tasks/:taskId                     Task workspace
    /tasks/:taskId/fund              Fund escrow step
    /tasks/:taskId/assign            Assign freelancer step
    /tasks/:taskId/submit            Submit deliverable (builder)
    /tasks/:taskId/verify            Trigger verification (any party)
    /tasks/:taskId/dispute           Escalate / vote on dispute
    /tasks/:taskId/reputation        Mint / view reputation NFT

/issues                              Wave-issue mode
  /issues/new                        Create issue (maintainer)
  /issues/:issueId                   Issue detail
    /issues/:issueId/claim           Claim (builder)
    /issues/:issueId/submit          Submit PR (builder)
    /issues/:issueId/award           Award + compliment (maintainer)

/buildathons                         Wave-buildathon mode
  /buildathons/new                   Create program
  /buildathons/:programId            Program detail (organizer tabs)
  /buildathons/:programId/team       Team registration
  /buildathons/:programId/submit     New submission
  /buildathons/:programId/submissions/:subId  Submission detail

/programs                            Wave program dashboard (organizer)
  /programs/new                      Create program
  /programs/:programId               Program detail
    /programs/:programId/waves       List waves
    /programs/:programId/waves/:waveId  Wave detail
    /programs/:programId/awarder     Grant / revoke awarder
    /programs/:programId/deposit     Top up pool
    /programs/:programId/finalize    Finalize wave

/reputation                          Own reputation (default to connected wallet)
  /reputation/:address               View any address
  /reputation/:address/nft/:tokenId  Single NFT detail
  /reputation/:address/stake         Stake / unstake $ZERO for verified badge

/disputes                            Open + closed disputes
  /disputes/:taskId                  Single dispute (events timeline + vote panel)

/github                              GitHub connection + linked repos
  /github/connect                    OAuth start
  /github/callback                   OAuth landing
  /github/repos                      List user's repos
  /github/repos/:owner/:repo         Repo detail (linked tasks, PRs)

/settings                            Theme, API key, dev banner
```

---

## 5. Shared UI Components

| Component | Purpose | Key props |
|---|---|---|
| `<AddressPill addr />` | Truncated address with copy + explorer link | `addr`, `showEns?` |
| `<HashDisplay hex truncate />` | Renders `0x…` with copy | `value`, `truncate?` |
| `<StatusBadge status />` | Color-coded enum badge (TaskStatus, WaveStatus, IssueState) | `status`, `kind` |
| `<Money amount token />` | Formats bigint string with decimals (USDC=6, ZERO=18) | `amount: string`, `token: "USDC" \| "ZERO"` |
| `<Countdown to />` | Live "ends in 3d 4h" using `block.timestamp` proxy | `to: number` (unix sec) |
| `<TxButton>` | wagmi `useWriteContract` + toast on success/failure | `calldata`, `to`, `label` |
| `<Stepper steps current />` | Multi-step transaction (e.g. approve → deposit) | `steps[]`, `current` |
| `<VerificationPanel taskId />` | Live AI score + CI status + oracle verdict stream | `taskId` |
| `<RepoCard repo />` | GitHub repo summary with "Connect to task" action | `repo` |
| `<IssueRow />` | Compact GitHub issue row | `issue` |
| `<NftCard />` | ERC-7857 NFT preview with intelligent data + stake status | `tokenId`, `owner` |
| `<PointsBar total mine />` | Visualizes share-of-points in a wave | `total: bigint`, `mine: bigint` |
| `<EmptyState icon title cta />` | Reusable empty pane | `title`, `cta?` |
| `<LiveBadge />` | Subscribes to WS; pulses on new event for this entity | `eventNames: string[]` |
| `<RoleGuard role />` | Hides UI if wallet lacks role | `role: "client" \| "freelancer" \| "organizer" \| "awarder" \| "judge"` |

---

## 6. State Management

- **Server cache** — TanStack Query keyed on entity IDs. Every backend endpoint is a query/mutation. Invalidate on WS broadcast for the same entity.
- **On-chain reads** — `wagmi` `useReadContract` for any view (e.g. `taskOf`, `escrowedOf`, `claimableShare`, `isVerified`).
- **WebSocket** — one shared WS connection (path: `ws://<host>/ws`). Subscribers receive JSON messages keyed by event name from `routers/route-factory.ts` `broadcast` field.
- **Form state** — `react-hook-form` + zod schemas mirrored from backend `route-schemas.ts`.

### 6.1 WS event surface (broadcast names)
```
TaskCreated, DeliverableSubmitted, Deposited, VerdictSubmitted, Released,
DisputeOpened, VoteCast, VerifiedBadgeStaked, ReputationMinted,
GithubRepoConnected, GithubPrLinked, GithubPrSynced,
GithubIssueCreated, GithubIssueStateChanged, GithubPullRequest
```

---

## 7. End-to-End User Flows

Each flow below lists: **trigger → pages touched → API calls → on-chain calls → success state → failure modes**.

### 7.1 FLOW A — Maintainer posts a paid task (escrow)

**Persona:** Maintainer / Client
**Goal:** Create a funded, escrowed, GitHub-linked task; assign a builder; release payment on pass.

#### Step-by-step
1. **/login** → connect wallet, connect GitHub.
2. **/tasks/new** form:
   - Title, description (Markdown)
   - Category (`Code=0 | Design=1 | Content=2 | Community=3`)
   - `repoUrl` (auto-suggested from GitHub repos)
   - `issueNumber` (optional — if creating inside an existing GitHub issue; auto-fills from `/v1/github/task/:id/issue`)
   - `paymentToken` (default MockUSDC on Galileo)
   - `reward` (USDC, 6 decimals — e.g. "100000000" = 100 USDC)
   - `deadline` (unix seconds; default now + 14d)
   - `coverageGateBps` (default 8000 = 80% test coverage gate)
   - **Spec content** — long-form Markdown + optional file attachments. Frontend uploads via `POST /v1/storage/upload-json` and uses returned `rootHash` as `specHash` (the spec must be encoded into a 32-byte hash; per contract, `specHash` is `bytes32`).
3. Client signs & submits the create-tx (from `POST /v1/tasks/create → { calldata, to, nextTaskId }`).
4. After on-chain `TaskCreated`, frontend routes to **`/tasks/:taskId`** (status: `Open`).
5. **Fund escrow** subpage `/tasks/:taskId/fund`:
   - `Stepper` shows: ① `Approve USDC` ② `Deposit to vault`.
   - Calls `POST /v1/escrow/approve` → wallet signs `approve(escrowVault, reward)`.
   - Calls `POST /v1/escrow/deposit` → wallet signs `deposit(taskId, reward)`.
   - Polls `GET /v1/escrow/:taskId` until `escrowed === reward`.
   - On `Deposited` WS event, advance to next step.
6. **Link GitHub** (if not done at creation): `POST /v1/github/connect { taskId, repo, issueNumber? }`.
7. **Assign freelancer** subpage `/tasks/:taskId/assign`:
   - Search by wallet address (or pick from candidate list).
   - `POST /v1/tasks/assign { taskId, freelancer }` → wallet signs.
   - Status transitions to `Assigned`.
8. **Builder submits** — see Flow B below.
9. **Verification** (any party can trigger) — `POST /v1/verification/verify { taskId, deliverableRef, repoUrl, prNumber, coverageGateBps }`. Pipeline:
   - CI runner (clones repo, runs tests, reports coverage).
   - AI scorer (0G compute; may 401 if no credits — UI must show "AI unavailable, CI passed" as soft-fail).
   - Oracle EIP-712 signs the `Verdict` struct.
   - Returns `{ verdict, verification: { score, reason, artifacts }, signer }`.
10. **Submit verdict** — `POST /v1/verification/submit` (backend signs and broadcasts `EscrowVault.submitVerdict`). Server-key only; the frontend just triggers it and shows tx status.
11. If `verdict.passed === true`:
    - `Released` event fires; status → `Passed`.
    - Escrow automatically pays `freelancer = reward * (1 - feeBps/10000)`, `treasury = reward * feeBps/10000`.
    - `ReputationMinted` event fires (escrow is `MINTER_ROLE` on `ReputationNFT`).
12. If `verdict.passed === false`:
    - Status → `Disputed`, `verdictFailed = true`, 14-day retry window starts.
    - Builder may resubmit during the window → re-runs Flow B + verification.
    - After 14 days, client may `POST /v1/disputes/escalate { taskId, arbiters: [..] }` → opens arbiter panel (status remains `Disputed`).
    - Arbiters `POST /v1/disputes/vote { taskId, choice }` until quorum reached; auto-resolves to `Resolved`; full escrow pays winner with 0 fee.

#### Failure modes the UI must handle
- **USDC not approved** — block Step 5② until approve confirms.
- **Reward > balance** — pre-check `balanceOf(msg.sender)` via wagmi; show error.
- **Spec upload too large** — `/v1/storage/upload-json` has 2 MB body limit; chunked upload not yet exposed.
- **Verification 401 (0G compute)** — show banner; let user proceed with CI-only score; require explicit confirmation.
- **Builder never submits** — `deadline` not auto-enforced on-chain; frontend must show a "deadline passed" banner and offer `POST /v1/escrow/refund` (client-only) when status is `Open`.
- **Dispute tie** — freelancer wins (lost-labor bias).

---

### 7.2 FLOW B — Builder claims + delivers a task

**Persona:** Builder / Freelancer
**Goal:** Get a task, submit a PR, get paid, mint reputation.

#### Step-by-step
1. **/marketplace/tasks** — filter by category, reward, deadline, repo.
2. Click task → **`/marketplace/tasks/:taskId`** (public):
   - Title, description (fetched from 0G Storage via `specHash`).
   - Repo link, issue link.
   - Client address + reputation (link to `/reputation/:client`).
   - Reward, deadline, status.
   - "Claim" button if `status === Open`.
3. **Claim** is implicit via `assignTask` — actually the **client assigns**, but the frontend should also offer a "Request to be assigned" CTA that DMs the client (out of scope MVP). For MVP, the **client** clicks assign in Flow A step 7.
4. **/tasks/:taskId/submit** (builder-only when status === `Assigned`):
   - GitHub PR link/URL field.
   - `deliverableRef` (defaults to PR URL).
   - Frontend computes `deliverableHash` via `deliverableHashOf(deliverableRef)` from `@zerolance/shared`.
   - `POST /v1/tasks/submit { taskId, deliverableRef, prNumber }` → wallet signs `submitDeliverable(taskId, deliverableHash, prNumber)`.
   - Status → `InReview`.
   - WS `DeliverableSubmitted` broadcasts.
5. **Verification** (any party may trigger) — see Flow A step 9.
6. On pass — same as Flow A step 11. Builder wallet now holds USDC.
7. **/tasks/:taskId/reputation** — on `ReputationMinted` event, show:
   - NFT card (tokenId, intelligent data description, data hash).
   - "Stake 1 ZERO to become Verified" CTA → calls `POST /v1/reputation/mint` if not yet minted (escrow-gated; auto-mints on pass in current backend), else navigates to stake flow.
8. **Optional staking** — `/reputation/:address/stake`:
   - `POST /v1/reputation/stake { tokenId, amount }` → wallet signs `stakeVerifiedBadge(tokenId)`. (⚠ Known issue: backend encodes only `tokenId`; `amount` is ignored. Track separately to fix.)
   - 7-day unstake timelock displayed.

#### Failure modes
- **Not assigned** — submit button disabled.
- **Hash mismatch** — on-chain revert `DeliverableMismatch`; frontend must warn if user changed PR after hash was computed.
- **Reverted verdict** — see Flow A step 12.

---

### 7.3 FLOW C — Maintainer runs a Wave Program (generic)

**Persona:** Wave Organizer
**Goal:** Create a multi-wave program, deposit pool, award points, finalize waves, auto-distribute.

#### Step-by-step
1. **/programs/new** form:
   - Token (USDC default), `genesisPool` (e.g. "10000000000" = 10k USDC).
   - `numWaves` (1–N).
   - `buildWindow`, `evalWindow`, `complimentWindow` (seconds).
   - `budgetMethod`: `FixedPerWave` | `PctOfRemaining`.
   - `feeBps` (0–10000, paid to `treasury`).
   - `treasury` address.
   - `specHash` (uploaded program spec to 0G Storage first).
2. Approve USDC, then `POST /v1/wave/program/:id/deposit` (signer-gated; backend signs and broadcasts `depositPool`).
3. **/programs/:programId** — organizer dashboard with tabs:
   - **Overview** — `GET /v1/wave/program/:id/meta` (remainingPool, waveBudget, totalPoints).
   - **Waves** — list with `WaveStatus` per wave.
   - **Awarders** — `POST /v1/wave/program/:id/awarder` (`grantAwarder`) to whitelist points awarders.
   - **Pool** — additional `deposit` for top-ups.
4. **Open a wave** — `POST /v1/wave/program/:id/open-wave` (signer-gated; returns `waveId`).
5. During `Open` + `Evaluation`:
   - Awarders call `program.awardBase / awardCompliment / awardCommunity` directly (or via the backend if exposed). Each routes to the per-program `PointsLedger`.
6. **Close wave** — `POST /v1/wave/program/:id/open-wave` then `closeWave` / `openEvaluation` (organizer-only on-chain; backend exposes these as signer-gated — or organizer wallet calls directly). `PointsLedger.freezeWave(waveId)` runs at `closeEvaluation`.
7. **Finalize** — `POST /v1/wave/program/:id/finalize { waveId }` → computes budget (`min(genesisPool/numWaves, remainingPool)` or `remainingPool/(numWaves - (waveSeq-1))`), sets `finalizedWaveBudget = budget * (10000-feeBps)/10000`.
8. **Claim** — contributor calls `POST /v1/wave/program/:id/claim { waveId }` → pays `share = (netBudget * contributorPoints) / totalPoints` (dust-capped to `netBudget - totalDistributed`).
9. Repeat for each wave until `waveSeq === numWaves`. Then `Program.remainingPool` is the leftover (re-usable for later programs by the same organizer is not a feature; leftover is the organizer's to `emergencyWithdraw`).

#### Failure modes
- **Pool not seeded** — `openWave` reverts `NotEnoughPool`.
- **Wave frozen** — any subsequent `award*` reverts `WaveFrozen`.
- **Already claimed** — `claim` reverts `AlreadyClaimed`.
- **Budget = 0** — `finalizeWave` reverts `ZeroBudget`; UI must warn when `remainingPool` is 0 before finalizing.

---

### 7.4 FLOW D — Maintainer runs Wave Issue Mode (paid GitHub issues)

**Persona:** Maintainer
**Goal:** Pre-fund a repo, post issues, award points to merged PRs, distribute to builders in next wave.

#### Step-by-step
1. Ensure the program exists (Flow C). Note `programId`.
2. **Accept repo** — backend route is `POST` (or direct call) to `WaveIssue.acceptRepo(programId, repoHash, true)`. The frontend computes `repoHash = keccak256(owner/repo)` (deterministic) and submits on-chain.
3. **/issues/new** form:
   - `programId` (auto-filled from accepted repo's program).
   - `repo` (must be accepted).
   - Title, body (Markdown), labels, base points (1–200), complexity (1=trivial, 2=medium, 3=high).
   - Optional: create a real GitHub issue via `POST /v1/github/issues/create` and link it.
4. `POST /v1/wave/issue/...`-equivalent (currently exposed as `GET /v1/wave/issue/:id` read-only; **writes are signer-gated via the WaveClient** — frontend should call the contract via wagmi using `WaveIssue` ABI from `packages/config/src/abis/zeroLanceWaveIssue.ts`).
5. Builder flow: **/issues/:issueId/claim**:
   - Requires `state === Created` and an open wave in the program.
   - Calls `WaveIssue.claimIssue(issueId)` (wagmi write).
   - `IssueClaimed` event; `state → Claimed`.
6. Builder **/issues/:issueId/submit**:
   - `deliverableHash` (PR URL hash), `prNumber`.
   - Calls `WaveIssue.submitPr(issueId, deliverableHash, prNumber)`.
   - `IssuePrSubmitted` event; `state → PrSubmitted`.
7. Maintainer **/issues/:issueId/award**:
   - View PR (linked via `POST /v1/github/task/:id/pr` if not yet linked).
   - Click "Merge confirmed" → `WaveIssue.confirmMerge(issueId)` awards `basePoints + bonusPoints` via `program.awardBase`.
   - `IssueMerged` event; `state → Awarded`.
8. Maintainer may add compliments anytime after merge: `WaveIssue.addCompliment(issueId, points)` — routes to `program.awardCompliment`.
9. **/issues/:issueId/award** has a "Close" button when state should move to `Closed` (admin/manager only).
10. After wave evaluation closes, builder claims USDC as in Flow C step 8.

#### Failure modes
- **Repo not accepted** — `createIssue` reverts `RepoNotAccepted`.
- **Base points > 200** — reverts `InvalidPoints`.
- **No wave open** — `claimIssue` reverts `NoWaveOpen`.
- **Builder ≠ claimer** — `submitPr` reverts `NotBuilder`.

---

### 7.5 FLOW E — Buildathon mode

**Persona:** Organizer + Teams + Judges + Community
**Goal:** Register teams, accept per-wave submissions, score with judges + community, distribute wave budget.

#### Step-by-step
1. Ensure program (Flow C) and at least one open wave.
2. **/buildathons/:programId/team** (any wallet):
   - `team` address (multi-sig optional), `productRepoHash`.
   - Calls `WaveBuildathon.registerTeam(programId, team, productRepoHash)`.
3. **/buildathons/:programId/submit** (team owner):
   - `contentHash` (demo/description/metrics on 0G Storage), `repoHash` (product repo).
   - Calls `WaveBuildathon.submit(programId, teamId, contentHash, repoHash)`.
4. **Judge scoring** — `/buildathons/:programId/submissions/:subId`:
   - Judge (whitelisted via `setJudge`) calls `WaveBuildathon.setSubmissionPoints(programId, subId, points)` → routes to `program.awardCommunity`.
5. **Community voting** — same page, non-judge wallets:
   - `WaveBuildathon.castVote(programId, subId, weight)` (one vote per wallet per submission; `weight` routes to `program.awardCommunity`).
6. Wave close + finalize + claim as in Flow C steps 6–8.

#### Failure modes
- **Already scored** — `setSubmissionPoints` reverts `AlreadyScored` if this address has already scored the same submission.
- **Already voted** — `castVote` reverts on second vote.
- **No wave open** — `submit` reverts `NoWaveOpen`.

---

### 7.6 FLOW F — Dispute resolution

**Persona:** Client / Builder / Arbiter
**Goal:** Escalate a failed verdict, gather votes, resolve.

#### Step-by-step
1. After `verdict.passed === false` and **14 days elapsed** since `verdictSubmittedAt`:
2. Client calls `POST /v1/disputes/escalate { taskId, arbiters: [..] }` (1–20 addresses; must be staked NFT holders).
3. `DisputeOpened` event; status remains `Disputed`; escrow stays locked.
4. **/disputes/:taskId** — shows:
   - Task summary
   - Timeline (verdict, escalate, votes) from `GET /v1/disputes/:id`
   - Vote panel (only enabled for the listed arbiters and only if `!hasVoted[taskId][arbiter]`)
5. Each arbiter calls `POST /v1/disputes/vote { taskId, choice: "Client" | "Freelancer" | "Abstain" }`.
6. Once `clientVotes + freelancerVotes + abstainVotes >= quorum`:
   - `DisputeResolved` event with `winner`.
   - Backend's `EscrowVault.resolveDispute(taskId, winner)` runs (called by `Arbitration`).
   - Full escrow (no fee) transfers to winner.
   - Status → `Resolved`.
7. Winners get reputation NFT (escrow auto-mints via the same path as a normal pass).
8. **Arbiter reward / slash**:
   - Winning arbiters (those who voted with the majority) earn `arbiterReward` $ZERO.
   - Owner may call `Arbitration.slashArbiter(address)` for collusion (phase 2).

#### Failure modes
- **Retry window still open** — `escalateDispute` reverts `RetryWindowOpen`; UI must hide escalate button until 14d passed.
- **Already voted** — `vote` reverts `AlreadyVoted`; UI prevents double-vote.
- **Slashed arbiter** — `vote` reverts `Slashed`.

---

### 7.7 FLOW G — Reputation: stake, view, transfer

**Persona:** Any builder
**Goal:** Stake $ZERO for a "Verified" badge; view NFT portfolio; transfer via ERC-7857.

#### Step-by-step
1. **/reputation/:address** (default connected wallet):
   - List of `ReputationMinted` NFTs (read `GET /v1/reputation/:id` filtered by address; or directly read `ReputationNFT.intelligentDatasOf`).
   - "Verified" badge if `stakeOf >= 1e18` (read `isVerified(address)`).
2. **Stake** — `/reputation/:address/stake`:
   - Approve $ZERO to `ReputationNFT` (via ERC20 `approve`).
   - Call `ReputationNFT.stakeVerifiedBadge(amount)` (frontend uses ABI from `packages/config/src/abis/zeroLanceReputationNFT.ts`).
3. **Unstake** — same page:
   - First call starts 7-day timelock; subsequent calls show `UnstakeTimelocked(readyAt)` countdown.
   - After timelock, `unstakeVerifiedBadge(amount)` succeeds.
4. **Transfer NFT** (advanced — gated by ERC-7857 proofs):
   - Use `iTransferFrom` / `iTransfer` with `TransferValidityProof[]` produced by the TEE verifier.
   - Bare `transferFrom` is **reverted** by the base contract — surface a clear error if a wallet tries it.
5. **Append portfolio data** — `ReputationNFT.appendPortfolio(tokenId, description, dataHash)` (owner only).

#### Failure modes
- **Insufficient stake** — UI hides "Verified" badge.
- **Unstake timelock** — countdown UI; disable button until ready.
- **Bare transfer** — wallet shows custom error `UseITransferWithProofs`; surface a help link.

---

## 8. Page-by-Page Spec

Each page entry below lists: **route, persona, layout, data sources, key actions, empty/loading/error states**.

### 8.1 `/` — Landing (public)
- Hero, 3-step explainer ("Post → Verify → Pay"), live stats (tasks, paid out, builders), CTA to `/marketplace` + `/login`.
- Data: `/v1/events?limit=5&eventName=Released` for "paid out" ticker.

### 8.2 `/login` — Auth
- See §2.4.

### 8.3 `/marketplace` — Browse
- **Layout:** left filter rail, right card grid, top sort selector.
- **Filters:** Category, reward range, status (default `Open`), repo URL, has-GitHub.
- **Cards:**
  - Task card: title, reward (`<Money>`), deadline (`<Countdown>`), repo, client reputation link.
  - Wave-program card: organizer, remaining pool, current wave, status, time-left in current phase.
- **Sort:** Newest, highest reward, ending soon.
- **Data:** `GET /v1/events?eventName=TaskCreated` for live feed; or backend should expose a list endpoint (current backend only has `GET /v1/events` with `since/eventName`; recommend adding a `/v1/tasks` list endpoint).

### 8.4 `/marketplace/tasks/:taskId` — Public task detail
- Header: title, status, reward, deadline, category.
- Tabs: **Description** (fetched via 0G Storage from `specHash`), **Repo** (issue + linked PR), **Activity** (events), **Reputation** (client + builder NFTs).
- "Connect wallet to claim/assign" CTA when logged in.

### 8.5 `/marketplace/waves/:programId` — Public program detail
- Program metadata (organizer, token, numWaves, budget method).
- Wave list with phase countdown.
- "Open" wave banner with current pool + total points.
- "Browse Issues" / "Browse Buildathons" sub-links.

### 8.6 `/tasks` — My tasks (role-aware)
- Tabs: **Posted** (client), **Assigned** (builder), **Watching** (any).
- Each row: status badge, reward, deadline, opponent link.
- Empty state: "You haven't posted a task yet. Create one →" (client) or "Browse marketplace to find work →" (builder).

### 8.7 `/tasks/new` — Create task
- Long form (see Flow A step 2). Multi-step stepper:
  1. Spec
  2. Repo + issue
  3. Payment + deadline
  4. Review + sign
- Live `nextTaskId` from `POST /v1/tasks/create` (preview).
- Validation mirrors zod schemas from `route-schemas.ts`.

### 8.8 `/tasks/:taskId` — Task workspace
- Tabbed: **Overview**, **Fund**, **Assign**, **Deliverable**, **Verify**, **Dispute**, **Reputation**, **Activity**.
- Header shows current `TaskStatus` with progress dots.
- Right rail: client + freelancer identity + their reputation.

### 8.9 `/tasks/:taskId/fund` — Fund escrow
- Stepper: Approve → Deposit. See Flow A step 5.

### 8.10 `/tasks/:taskId/assign` — Assign freelancer
- Address input (with ENS/avatar lookup via wagmi).
- "Pick from suggested" — show top 5 builders by reputation.
- Confirm modal showing the freelancer's stats (tasks done, avg score).

### 8.11 `/tasks/:taskId/submit` — Submit deliverable
- PR URL or branch SHA.
- Auto-fills `prNumber` from `GET /v1/github/task/:id/repo` if connected.
- "Run verification preview" (dry-run CI) — optional CTA.

### 8.12 `/tasks/:taskId/verify` — Verification
- `<VerificationPanel>` showing live AI score, CI status, oracle signature.
- "Submit to chain" button → `POST /v1/verification/submit` (server-signed).
- Soft-fail banners: "AI scorer unavailable", "CI didn't run".

### 8.13 `/tasks/:taskId/dispute` — Dispute
- Status-aware:
  - `verdictFailed && now < verdictSubmittedAt + 14d` → show "Retry window open. Builder can resubmit."
  - `now >= +14d && !resolved` → "Escalate to arbiters" CTA.
  - `DisputeOpened` → vote panel (only enabled for listed arbiters).

### 8.14 `/tasks/:taskId/reputation` — Reputation
- Shows minted NFT (or "Will mint on pass").
- "View on reputation page" link.

### 8.15 `/issues` — Wave issue list
- Filter: my issues, claimed, open, merged.
- Card: title, repo, base points, complexity, status.

### 8.16 `/issues/new` — Create issue
- See Flow D step 3.

### 8.17 `/issues/:issueId` — Issue detail
- Tabs: **Description**, **Submissions (PRs)**, **Points**, **Activity**.
- Action area adapts to `state`:
  - `Created` → builder sees "Claim"; maintainer sees "Set points / Close".
  - `Claimed` → builder sees "Submit PR".
  - `PrSubmitted` → maintainer sees "Confirm merge".
  - `Awarded` → maintainer sees "Add compliment" / "Close".
  - `Closed` → read-only.

### 8.18 `/buildathons` — Buildathon list
- Active programs (filter: `currentWave > 0 && waveStatus !== Closed`).
- Card: title, organizer, current wave, teams count, time-left.

### 8.19 `/buildathons/:programId` — Program detail
- Tabs: **Overview**, **Teams**, **Submissions**, **Waves**, **Awarders/Judges**, **Pool**.
- Action buttons appear by role (organizer/awarder/judge/team).

### 8.20 `/buildathons/:programId/team` — Team registration
- See Flow E step 2.

### 8.21 `/buildathons/:programId/submit` — New submission
- See Flow E step 3.

### 8.22 `/buildathons/:programId/submissions/:subId` — Submission detail
- Live scores panel (judge + community), vote CTA for non-judges, score CTA for judges, "View on 0G Storage" link for `contentHash`.

### 8.23 `/programs` — Program dashboard
- Same layout as `/buildathons` but for generic programs (no team/issue tabs).

### 8.24 `/programs/:programId` — Program detail
- See Flow C step 3.

### 8.25 `/reputation` + `/reputation/:address` — Reputation profile
- Verified badge, total NFTs, points total, links to each NFT.

### 8.26 `/reputation/:address/nft/:tokenId` — NFT detail
- Intelligent data list (description + data hash + 0G Storage link).
- Stake status (`stakeOf`).
- "Append portfolio data" (owner).
- "Transfer" (advanced ERC-7857 flow with proof generation).

### 8.27 `/reputation/:address/stake` — Stake
- See Flow G step 2.

### 8.28 `/disputes` — Dispute list
- Two columns: open vs resolved.
- Card: task, status, votes tally, time remaining.

### 8.29 `/disputes/:taskId` — Single dispute
- See Flow F step 4.

### 8.30 `/github` — GitHub connection
- Connection status card (linked login, avatar).
- "Connect GitHub" CTA if not linked.
- "Linked repos" table.

### 8.31 `/github/connect` + `/github/callback`
- Plain redirect page; see §2.3.

### 8.32 `/github/repos` + `/github/repos/:owner/:repo`
- Repo list + detail with linked tasks/PRs.

### 8.33 `/settings`
- Theme toggle, `ZERO_CLIENT_API_KEY` input (advanced; for self-host), dev banner toggle, network switcher.

---

## 9. Cross-Cutting Concerns

### 9.1 BigInt handling
- All IDs, scores, amounts, timestamps are **strings** in API responses. Keep them as strings in state to avoid precision loss.
- Display layer: use `<Money>` for token amounts, `<Countdown>` for timestamps, `<HashDisplay>` for hashes, plain string for IDs.

### 9.2 Loading + error states (global)
- **Loading:** skeleton cards; never blank panes.
- **Error:** toast + retry button. For 503 with `code: "WAVE_NOT_CONFIGURED"` etc., show a permanent banner "Feature not deployed on this network".
- **Tx errors:** decode revert reason when possible (viem `decodeErrorResult`) and surface a human message.

### 9.3 Wallet-gated writes
- Every "Sign" button must be disabled if wallet is disconnected or on wrong chain.
- Pre-flight `useSimulateContract` (wagmi) where applicable to catch reverts before sending.

### 9.4 WebSocket subscriptions
- Single connection at app boot; tear down on logout.
- Use the event names from §6.1 to update query caches.
- `LiveBadge` component wraps any entity (task, wave, NFT) to pulse on relevant events.

### 9.5 Feature flags
- `waveClient === null` (env unset) → hide `/programs`, `/buildathons`, `/issues` new flows; show "Wave funding not deployed here" notice.
- `storageBackend === "in-memory"` → add a yellow banner on any 0G Storage upload ("Local-only; not persisted on testnet").
- `ZERO_DISABLE_AUTH=true` → show "Dev mode — auth disabled" banner.

### 9.6 Permissions matrix (UI-level)
| Action | Wallet role |
|---|---|
| Create task | Anyone with USDC |
| Fund escrow | Task client |
| Assign freelancer | Task client |
| Submit deliverable | Task freelancer |
| Trigger verify | Anyone |
| Escalate dispute | Task client, after 14d |
| Vote in dispute | Listed arbiter (staked NFT, not slashed, hasn't voted) |
| Mint reputation | Escrow (auto) |
| Stake/unstake badge | NFT owner / address with stake |
| Create program | Anyone with USDC |
| Open/finalize wave | Program organizer |
| Grant awarder | Program organizer |
| Award points | Awarder (or organizer) |
| Register team / submit | Anyone (during open wave) |
| Score buildathon | Judge or organizer |
| Cast buildathon vote | Anyone (once per submission) |
| Pause protocol | Owner (timelock) |

### 9.7 Empty / loading / error templates
- Reusable templates: `<EmptyState>`, `<SkeletonCard>`, `<ErrorPane retry />`. Every list page must handle all three.

### 9.8 Accessibility
- All status badges have text + color (not color-only).
- All forms have labels; steppers have aria-progressbar.
- All copy buttons announce success to screen readers.

### 9.9 i18n-ready
- All user-facing strings via a single `t()` function (e.g. `useTranslation`); MVP ships en only.

---

## 10. Backend Touchpoints — Quick Map

Frontend ↔ backend endpoints used per flow:

| Flow | Endpoints |
|---|---|
| A — Post task | `POST /v1/tasks/create`, `POST /v1/escrow/approve`, `POST /v1/escrow/deposit`, `POST /v1/tasks/assign`, `POST /v1/github/connect`, `POST /v1/verification/verify`, `POST /v1/verification/submit`, `GET /v1/escrow/:id` |
| B — Builder | `GET /v1/github/task/:id/repo`, `POST /v1/github/task/:id/pr`, `POST /v1/tasks/submit`, `POST /v1/verification/verify`, `POST /v1/reputation/mint` (auto via escrow; fallback call) |
| C — Wave program | `POST /v1/storage/upload-json`, `POST /v1/wave/program/:id/deposit`, `POST /v1/wave/program/:id/open-wave`, `POST /v1/wave/program/:id/finalize`, `POST /v1/wave/program/:id/claim`, `GET /v1/wave/program/:id/meta`, `GET /v1/wave/program/:id/claimable` |
| D — Wave issue | `GET /v1/wave/issue/:id`, `POST /v1/github/issues/create` (optional), direct contract writes via wagmi for `acceptRepo`/`createIssue`/`claimIssue`/`submitPr`/`confirmMerge`/`addCompliment` |
| E — Buildathon | `GET /v1/wave/buildathon/submission/:id`, direct contract writes via wagmi for `registerTeam`/`submit`/`setSubmissionPoints`/`castVote`/`setJudge` |
| F — Dispute | `POST /v1/disputes/escalate`, `POST /v1/disputes/vote`, `GET /v1/disputes/:id` |
| G — Reputation | `GET /v1/reputation/:id`, direct contract reads via wagmi (`isVerified`, `stakeOf`, `intelligentDatasOf`), `ReputationNFT` writes via wagmi for `stakeVerifiedBadge`/`unstakeVerifiedBadge`/`appendPortfolio`/`iTransferFrom` |
| Global | `GET /v1/config`, `GET /health`, `GET /v1/events`, `GET /v1/storage/status`, `GET /v1/da/summary`, `POST /v1/storage/upload-json` |

### Direct contract writes (wagmi, no backend)
- All `WaveIssue` writes (Flow D) — ABI in `packages/config/src/abis/zeroLanceWaveIssue.ts`.
- All `WaveBuildathon` writes (Flow E) — ABI in `packages/config/src/abis/zeroLanceWaveBuildathon.ts`.
- All `ReputationNFT` writes (Flow G) — ABI in `packages/config/src/abis/zeroLanceReputationNFT.ts`.
- ERC20 `approve` / `transfer` for USDC and ZERO.
- All reads that backend doesn't proxy (e.g. `taskOf`, `escrowedOf`, `isVerified`, `claimableShare`, `program()`, `wave()`, `issue()`, `submission()`).

---

## 11. Known Backend Behaviors the Frontend Must Compensate For

These are quirks / gaps observed in the current backend that the frontend should handle gracefully:

1. **No `GET /v1/tasks` list endpoint** — task list pages must use `GET /v1/events?eventName=TaskCreated` and then enrich per task via `taskOf`-style reads. Recommend filing a backend ticket.
2. **`/v1/reputation/stake` ignores `amount`** — backend only encodes `tokenId`; the actual `stakeVerifiedBadge(tokenId)` is a fixed-amount call on the current contract version. Frontend should not show an amount field until this is fixed (or call the contract directly).
3. **Verification soft-fails** — AI scorer may 401 (no 0G credits) and CI may fail to clone. UI must show soft-fail banner, not block.
4. **0G Storage may be in-memory** — `GET /v1/storage/status` reveals `backend`. Warn user that uploads won't persist on testnet unless `"0g"`.
5. **Wave address env vars** — if any of `ZERO_WAVE_PROGRAM_ADDRESS` / `ZERO_WAVE_ISSUE_ADDRESS` / `ZERO_WAVE_BUILDATHON_ADDRESS` is unset, `GET /v1/config` will reflect this. Frontend should hide corresponding nav items.
6. **GitHub auth callback** — the `login` query param is the only signal of success; parse it and store the access token obtained from a follow-up call (the backend currently doesn't return the token in the callback; **need a backend fix** to expose the access token for the browser). Until then, the frontend may need to call a hypothetical `GET /v1/github/session` after callback.
7. **Dev mode (`ZERO_DISABLE_AUTH=true`)** — show a persistent yellow banner so users don't accidentally test without auth in production.
8. **`POST /v1/escrow/refund` is unguarded** — the backend doesn't gate refund to escrow owner; the frontend must ensure the connected wallet is the task client.
9. **ABI struct warnings** — viem warns on `struct Verdict`/`struct Task`; harmless, suppress in dev.

---

## 12. Out of Scope (MVP)

These are explicitly **not** in the current backend/contracts and should be marked "coming soon" rather than built:

- Off-chain messaging between client and builder (use GitHub for now).
- Email/SMS notifications.
- KYC / fiat on-ramp.
- Mobile-native apps (web responsive only).
- Multi-currency pricing (USDC and $ZERO only; native 0G not in MVP).
- Cross-program leaderboards.
- ERC-7857 iTransfer proof generation UI (advanced; TEE-signed proofs only).

---

## 13. Acceptance Criteria

A flow is "done" when:

1. All steps in §7 are clickable end-to-end against a live dev backend.
2. The relevant integration tests in `apps/backend/src/**/integration.test.ts` still pass.
3. Every page handles empty / loading / error / not-deployed states.
4. Wallet is required for every write; soft-fail banners are explicit.
5. All bigint values are strings end-to-end.
6. WS subscription updates the UI without a refresh.
7. The status badge in the header matches the on-chain `TaskStatus` / `WaveStatus` / `IssueState`.
8. A passing task shows the minted NFT within 30s of `Released`.
9. An escalated dispute shows a vote panel for the correct arbiters only.
10. The dev banner is visible in `ZERO_DISABLE_AUTH=true` mode and hidden otherwise.

---

## 14. Open Questions for Product

1. Should `/marketplace` show only `Open` tasks, or also `Assigned` (so builders can see market depth)?
2. Is the "Request to be assigned" UX in scope, or is assignment always client-initiated?
3. For wave issue mode, should maintainers be able to set per-issue reward amounts (currently points-based only)?
4. Should the frontend generate ERC-7857 iTransfer proofs locally, or always go through a TEE? (Affects Flow G transfer UX.)
5. What's the policy for displaying soft-failed verdicts (CI passed but AI failed, or vice versa)?
6. Is the unstake timelock cancellation flow (if `unstakeReadyAt` was set then more is staked) a blocker for UX? (Current contract zeroes the timer on new stake.)
