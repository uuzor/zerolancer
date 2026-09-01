# ZeroLance Backend Plans — 3 Product Surfaces

## Current 0G Backend Usage (before rewrite)

| 0G Service | Current Usage | Module |
|---|---|---|
| **0G Compute** | AI scoring of deliverables (0-100). Called by `VerdictOrchestrator.aiScore()` via OpenAI-compatible router. Model: `0gm-1.0-35b-a3b`. Falls back to CI-only if no key. | `apps/backend/src/compute/verdict-orchestrator.ts:200` |
| **0G Storage** | Upload artifacts: encrypted task specs, PR diffs, test results, AI results, DA batch blobs. `StorageService` wraps `ZeroGStorage` (real) or `InMemoryStorage` (fallback). | `apps/backend/src/storage/service.ts` |
| **0G DA** | Anchor event batches. `DaPublisher` collects events from `EventStore`, batches them (max 50, flush 5s), uploads as content-addressed blob, produces `batchRoot` commitment. | `apps/backend/src/da/publisher.ts` |
| **INFT (ERC-7857)** | Reputation NFTs minted after task completion. `ZeroLanceTaskEscrow.mintReputation()` calls `IZeroLanceReputationNFT.mintReputation()`. Encrypted metadata re-keyed on transfer via TEE. | `apps/contracts/src/ZeroLanceReputationNFT.sol` |

---

## Plan 1: Task Marketplace Backend

### User Flow
1. **Owner** connects GitHub repo via OAuth → backend stores `repoUrl` + access token
2. **Owner** creates task: fills spec (markdown + attachments), sets reward, deadline, coverage gate
   - Spec uploaded to 0G Storage → `specHash` (keccak256)
   - `createTask` calldata returned to frontend for wallet signing
3. **Builder** browses open tasks, claims one
   - `assignTask` calldata returned for owner to sign (or auto-assign if open)
4. **Builder** builds, creates PR, submits deliverable
   - `submitDeliverable` calldata returned for builder to sign
   - PR diff optionally uploaded to 0G Storage → `deliverableHash`
5. **Backend** runs verification pipeline:
   - Fetch GitHub PR status (merge state, CI checks)
   - Run `GithubRunner` (clone PR, lint, test, coverage) as fallback
   - Call 0G Compute for AI scoring (optional)
   - Combine into `VerificationResult` (passed/failed + score + artifacts)
   - Oracle signs verdict (EIP-712)
   - Backend submits `submitVerdict` on-chain → escrow auto-releases
6. **Escrow** releases: freelancer gets `reward * (1 - feeBps/10000)`, treasury gets fee
7. **Reputation NFT** minted to freelancer (encrypted metadata on 0G Storage)

### Contract Interactions
| Contract | Function | Trigger |
|---|---|---|
| `ZeroLanceTaskRegistry` | `createTask` | Owner signs calldata |
| `ZeroLanceTaskRegistry` | `assignTask` | Owner/builder signs |
| `ZeroLanceTaskRegistry` | `submitDeliverable` | Builder signs |
| `ZeroLanceTaskEscrow` | `deposit` | Client signs (after approve) |
| `ZeroLanceTaskEscrow` | `submitVerdict` | Backend signer submits signed verdict |
| `ZeroLanceTaskEscrow` | `resolveDispute` | Backend signer (if dispute) |
| `ZeroLanceReputationNFT` | `mintReputation` | Backend signer |

### DB Schema
```sql
-- tasks (source of truth for task lifecycle)
CREATE TABLE tasks (
  taskId TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  freelancer TEXT,
  specHash TEXT NOT NULL,
  repoUrl TEXT,
  issueNumber INTEGER,
  reward TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT DEFAULT 'Open', -- Open, Assigned, InReview, Passed, Disputed, Resolved, Cancelled
  category TEXT DEFAULT 'Code',
  coverageGateBps INTEGER DEFAULT 8000,
  deliverableHash TEXT,
  prNumber INTEGER,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

-- github_connections (OAuth tokens per user)
CREATE TABLE github_connections (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  login TEXT NOT NULL,
  accessToken TEXT NOT NULL,
  repoUrl TEXT,
  connectedAt TEXT DEFAULT (datetime('now'))
);

-- disputes (backend-managed)
CREATE TABLE disputes (
  taskId TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Open', -- Open, Voting, Resolved
  votes TEXT, -- JSON array of {arbiter, choice}
  winner TEXT,
  resolvedAt TEXT
);

-- verification_artifacts (CI + AI results)
CREATE TABLE verification_artifacts (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  kind TEXT NOT NULL, -- ci, lint, coverage, llm-similarity
  label TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  detail TEXT,
  metric INTEGER,
  createdAt TEXT DEFAULT (datetime('now'))
);
```

### API Routes
| Method | Path | Description |
|---|---|---|
| POST | `/v1/tasks/create` | Return calldata for `createTask` |
| POST | `/v1/tasks/assign` | Return calldata for `assignTask` |
| POST | `/v1/tasks/submit` | Return calldata for `submitDeliverable` |
| POST | `/v1/verification/verify` | Run CI + AI + sign verdict |
| POST | `/v1/verification/submit` | Submit signed verdict on-chain |
| GET | `/v1/tasks/:id` | Read task + verification status |
| GET | `/v1/tasks` | List open tasks |
| POST | `/v1/github/connect` | OAuth connect |
| GET | `/v1/github/me` | Get connected GitHub user |
| POST | `/v1/github/task/:id/repo` | Link repo to task |
| GET | `/v1/github/task/:id/pr` | Get PR status |
| POST | `/v1/escrow/approve` | Return calldata for ERC20 approve |
| POST | `/v1/escrow/deposit` | Return calldata for deposit |
| GET | `/v1/escrow/:id` | Read escrow status |
| POST | `/v1/escrow/refund` | Return calldata for refund |

### 0G Service Usage
| Service | When | What |
|---|---|---|
| **0G Storage** | Task creation | Upload encrypted spec → `specHash` on-chain |
| **0G Storage** | Deliverable submission | Upload PR diff → `deliverableHash` on-chain |
| **0G Compute** | Verification | AI scoring of deliverable (optional, non-blocking) |
| **0G DA** | Events | Anchor `TaskCreated`, `DeliverableSubmitted`, `VerdictSubmitted` events |
| **INFT** | Post-verdict | Mint reputation NFT to freelancer |

### Implementation Order
1. DB schema (tasks, github_connections, disputes, verification_artifacts)
2. Task routes (create, assign, submit)
3. GitHub integration (OAuth, PR status)
4. Verification pipeline (CI runner + AI scoring + oracle sign)
5. Escrow routes (approve, deposit, refund)
6. Reputation minting
7. Event store + DA anchoring

---

## Plan 2: OSS Wave Funding Backend

### User Flow
1. **Organiser** creates wave program:
   - Fills program details (name, description, theme)
   - Sets `numWaves`, `budgetMethod` (FixedPerWave or PctOfRemaining)
   - Funds pool (USDC deposited to `WaveFundingVault`)
   - `createProgram` called on-chain → returns `programId`
2. **Maintainer** applies to have repo approved:
   - Submits `repoUrl` (e.g., `https://github.com/owner/repo`)
   - Organiser reviews and approves → `repoHash = keccak256(bytes(repoUrl))` stored in DB
   - Backend signer can optionally call `vault.setPoints` for approved repos (if needed)
3. **Maintainer** creates issues on approved repos:
   - Fills issue spec (title, description, basePoints, complexity)
   - Spec uploaded to 0G Storage → `specHash`
   - Issue created in DB with `state = Open`
   - AI/team can adjust `basePoints` (capped at 200)
4. **Builder** browses open issues, claims one:
   - `claimIssue` in DB → `state = Claimed`, `builder` assigned
5. **Builder** builds, submits PR:
   - PR URL + `deliverableHash` stored in DB
   - `state = PrSubmitted`
6. **Maintainer** reviews PR, confirms merge:
   - `confirmMerge` in DB → `state = Merged`
   - Backend signer calls `vault.setPoints(waveId, builder, basePoints + bonusPoints)`
   - Points flow through `PointsLedger`-style accounting in DB
7. **Organiser** manages wave lifecycle:
   - `openWave` → builders can claim issues
   - `closeWave` → no more claims
   - `closeEvaluation` → no more merges
   - `finalizeWave` → budget locked, `WaveStatus.Finalized`
8. **Builder** claims payout:
   - Calls `vault.claim(waveId, builder)` or backend calls it
   - Contract computes `(netBudget * builderPoints) / totalWavePoints`
   - USDC transferred to builder

### Contract Interactions
| Contract | Function | Trigger |
|---|---|---|
| `WaveFundingVault` | `createProgram` | Organiser signs |
| `WaveFundingVault` | `deposit` | Organiser signs |
| `WaveFundingVault` | `openWave` | Organiser signs |
| `WaveFundingVault` | `closeWave` | Organiser signs |
| `WaveFundingVault` | `finalizeWave` | Organiser signs |
| `WaveFundingVault` | `setPoints` | Backend signer (after merge) |
| `WaveFundingVault` | `claim` | Builder (or backend) |
| `WaveFundingVault` | `emergencyWithdraw` | Owner (emergency) |

### DB Schema
```sql
-- wave_programs (source of truth for program metadata)
CREATE TABLE wave_programs (
  programId TEXT PRIMARY KEY,
  organizer TEXT NOT NULL,
  token TEXT NOT NULL,
  treasury TEXT NOT NULL,
  feeBps INTEGER NOT NULL,
  numWaves INTEGER NOT NULL,
  budgetMethod TEXT DEFAULT 'FixedPerWave',
  description TEXT,
  specHash TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- wave_waves (per-wave state)
CREATE TABLE wave_waves (
  waveId TEXT PRIMARY KEY,
  programId TEXT NOT NULL,
  waveSeq INTEGER NOT NULL,
  buildEndAt TEXT,
  evalEndAt TEXT,
  status TEXT DEFAULT 'Open', -- Open, Evaluation, Finalized, Closed
  budget TEXT,
  finalized BOOLEAN DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- oss_repos (approved repos)
CREATE TABLE oss_repos (
  id TEXT PRIMARY KEY,
  programId TEXT NOT NULL,
  repoHash TEXT NOT NULL,
  repoUrl TEXT NOT NULL,
  approved BOOLEAN DEFAULT 0,
  approvedAt TEXT,
  approvedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- oss_issues (issue lifecycle)
CREATE TABLE oss_issues (
  issueId TEXT PRIMARY KEY,
  programId TEXT NOT NULL,
  repoHash TEXT NOT NULL,
  maintainer TEXT NOT NULL,
  specHash TEXT,
  basePoints INTEGER DEFAULT 0,
  complexity INTEGER DEFAULT 2,
  state TEXT DEFAULT 'Open', -- Open, Claimed, PrSubmitted, Merged, Closed
  builder TEXT,
  deliverableHash TEXT,
  prNumber INTEGER,
  mergedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- wave_builder_points (points per builder per wave)
CREATE TABLE wave_builder_points (
  id TEXT PRIMARY KEY,
  waveId TEXT NOT NULL,
  builder TEXT NOT NULL,
  points INTEGER NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')),
  UNIQUE(waveId, builder)
);

-- wave_claims (payout history)
CREATE TABLE wave_claims (
  id TEXT PRIMARY KEY,
  waveId TEXT NOT NULL,
  builder TEXT NOT NULL,
  amount TEXT NOT NULL,
  txHash TEXT,
  claimedAt TEXT DEFAULT (datetime('now'))
);
```

### API Routes
| Method | Path | Description |
|---|---|---|
| POST | `/v1/wave/program` | Create wave program |
| POST | `/v1/wave/program/:id/deposit` | Deposit to program |
| POST | `/v1/wave/program/:id/open-wave` | Open new wave |
| POST | `/v1/wave/program/:id/close-wave` | Close wave |
| POST | `/v1/wave/program/:id/close-evaluation` | Close evaluation |
| POST | `/v1/wave/program/:id/finalize` | Finalize wave |
| POST | `/v1/wave/program/:id/award` | Set points (signer) |
| POST | `/v1/wave/program/:id/claim` | Claim payout |
| POST | `/v1/wave/oss/accept-repo` | Approve repo |
| POST | `/v1/wave/oss/issue` | Create issue |
| POST | `/v1/wave/oss/issue/:id/points` | Set issue points |
| POST | `/v1/wave/oss/issue/:id/claim` | Claim issue |
| POST | `/v1/wave/oss/issue/:id/pr` | Submit PR |
| POST | `/v1/wave/oss/issue/:id/merge` | Confirm merge |
| GET | `/v1/wave/program/:id` | Read program |
| GET | `/v1/wave/program/:id/wave/:waveId` | Read wave |
| GET | `/v1/wave/program/:id/claimable` | Claimable share |
| GET | `/v1/wave/issue/:id` | Read issue |

### 0G Service Usage
| Service | When | What |
|---|---|---|
| **0G Storage** | Issue creation | Upload issue spec → `specHash` |
| **0G Compute** | Merge confirmation | AI scoring of merged PR (optional) |
| **0G DA** | Events | Anchor `WaveOpened`, `WaveFinalized`, `PointsSet`, `WaveClaimed` events |
| **INFT** | Not used | OSS mode doesn't mint reputation NFTs |

### Implementation Order
1. DB schema (wave_programs, wave_waves, oss_repos, oss_issues, wave_builder_points, wave_claims)
2. Wave program routes (create, deposit, open/close/finalize)
3. OSS repo approval routes
4. OSS issue lifecycle routes
5. Points management (DB + on-chain `setPoints`)
6. Claim routes
7. Event store + DA anchoring

---

## Plan 3: Buildathon Wave Funding Backend

### User Flow
1. **Organiser** creates buildathon program:
   - Fills program details (name, theme, criteria, description)
   - Sets `numWaves`, `budgetMethod`
   - Funds pool (USDC deposited to `WaveFundingVault`)
   - `createProgram` called on-chain → returns `programId`
2. **Builder** registers project:
   - Submits `wallet` address + `repoUrl` (full GitHub URL)
   - Project created in DB with `state = Registered`
   - `repoHash = keccak256(bytes(repoUrl))` stored on-chain if needed
3. **Organiser/Awarder** assigns points per wave:
   - Reviews projects
   - Sets `points` per project per wave
   - Backend signer calls `vault.setPoints(waveId, builder, points)`
4. **Organiser** manages wave lifecycle:
   - `openWave` → builders can submit/refresh
   - `closeWave` → no more submissions
   - `closeEvaluation` → judging complete
   - `finalizeWave` → budget locked
5. **Builder** claims payout:
   - Calls `vault.claim(waveId, builder)` or backend calls it
   - Contract computes `(netBudget * builderPoints) / totalWavePoints`
   - USDC transferred to builder
6. **Leftover** rolls to next wave:
   - If a builder has 0 points, their share stays in pool
   - Next wave's budget = `(pooled - distributed) / remainingWaves`

### Contract Interactions
| Contract | Function | Trigger |
|---|---|---|
| `WaveFundingVault` | `createProgram` | Organiser signs |
| `WaveFundingVault` | `deposit` | Organiser signs |
| `WaveFundingVault` | `openWave` | Organiser signs |
| `WaveFundingVault` | `closeWave` | Organiser signs |
| `WaveFundingVault` | `finalizeWave` | Organiser signs |
| `WaveFundingVault` | `setPoints` | Backend signer (organiser/awarder assigns) |
| `WaveFundingVault` | `claim` | Builder (or backend) |
| `WaveFundingVault` | `emergencyWithdraw` | Owner (emergency) |

### DB Schema
```sql
-- wave_programs (same as OSS)
CREATE TABLE wave_programs (
  programId TEXT PRIMARY KEY,
  organizer TEXT NOT NULL,
  token TEXT NOT NULL,
  treasury TEXT NOT NULL,
  feeBps INTEGER NOT NULL,
  numWaves INTEGER NOT NULL,
  budgetMethod TEXT DEFAULT 'FixedPerWave',
  description TEXT,
  specHash TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- wave_waves (same as OSS)
CREATE TABLE wave_waves (
  waveId TEXT PRIMARY KEY,
  programId TEXT NOT NULL,
  waveSeq INTEGER NOT NULL,
  buildEndAt TEXT,
  evalEndAt TEXT,
  status TEXT DEFAULT 'Open',
  budget TEXT,
  finalized BOOLEAN DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- buildathon_teams (project registration)
CREATE TABLE buildathon_teams (
  teamId TEXT PRIMARY KEY,
  programId TEXT NOT NULL,
  wallet TEXT NOT NULL,
  repoUrl TEXT NOT NULL,
  repoHash TEXT NOT NULL,
  name TEXT,
  description TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- buildathon_submissions (per-wave submissions)
CREATE TABLE buildathon_submissions (
  subId TEXT PRIMARY KEY,
  teamId TEXT NOT NULL,
  waveId TEXT NOT NULL,
  contentHash TEXT,
  repoHash TEXT,
  points INTEGER DEFAULT 0,
  state TEXT DEFAULT 'Submitted', -- Submitted, Evaluated, Awarded
  evaluatedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

-- wave_builder_points (points per builder per wave)
CREATE TABLE wave_builder_points (
  id TEXT PRIMARY KEY,
  waveId TEXT NOT NULL,
  builder TEXT NOT NULL,
  points INTEGER NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')),
  UNIQUE(waveId, builder)
);

-- wave_claims (payout history)
CREATE TABLE wave_claims (
  id TEXT PRIMARY KEY,
  waveId TEXT NOT NULL,
  builder TEXT NOT NULL,
  amount TEXT NOT NULL,
  txHash TEXT,
  claimedAt TEXT DEFAULT (datetime('now'))
);
```

### API Routes
| Method | Path | Description |
|---|---|---|
| POST | `/v1/wave/program` | Create buildathon program |
| POST | `/v1/wave/program/:id/deposit` | Deposit to program |
| POST | `/v1/wave/program/:id/open-wave` | Open new wave |
| POST | `/v1/wave/program/:id/close-wave` | Close wave |
| POST | `/v1/wave/program/:id/close-evaluation` | Close evaluation |
| POST | `/v1/wave/program/:id/finalize` | Finalize wave |
| POST | `/v1/wave/program/:id/award` | Set points (signer) |
| POST | `/v1/wave/program/:id/claim` | Claim payout |
| POST | `/v1/wave/buildathon/team` | Register team/project |
| POST | `/v1/wave/buildathon/submission` | Submit/refresh project |
| POST | `/v1/wave/buildathon/submission/:id/points` | Set submission points |
| POST | `/v1/wave/buildathon/submission/:id/vote` | Community vote |
| GET | `/v1/wave/program/:id` | Read program |
| GET | `/v1/wave/program/:id/wave/:waveId` | Read wave |
| GET | `/v1/wave/program/:id/teams` | List teams |
| GET | `/v1/wave/program/:id/claimable` | Claimable share |

### 0G Service Usage
| Service | When | What |
|---|---|---|
| **0G Storage** | Project submission | Upload project content → `contentHash` |
| **0G Compute** | Judging | AI scoring of project submissions (optional) |
| **0G DA** | Events | Anchor `WaveOpened`, `WaveFinalized`, `PointsSet`, `WaveClaimed` events |
| **INFT** | Not used | Buildathon mode doesn't mint reputation NFTs |

### Implementation Order
1. DB schema (wave_programs, wave_waves, buildathon_teams, buildathon_submissions, wave_builder_points, wave_claims)
2. Buildathon program routes (create, deposit, open/close/finalize)
3. Team/project registration routes
4. Submission routes
5. Points management (DB + on-chain `setPoints`)
6. Claim routes
7. Event store + DA anchoring

---

## Shared Backend Components (all 3 styles)

### Event Store + DA Publisher
All three styles share the same `EventStore` + `DaPublisher` pattern:
- Events appended to `EventStore` (in-memory ring buffer + persisted JSON)
- `DaPublisher` batches events and anchors on 0G Storage
- WS broadcaster pushes events to connected clients

### Storage Service
All three styles share `StorageService`:
- Upload specs, deliverables, project content, artifacts
- Download by `rootHash`
- Falls back to in-memory if no 0G config

### Oracle Client
Task marketplace uses oracle for verdict signing. Wave modes don't need oracle (points are set by backend signer directly).

### Backend Signer
All on-chain writes (setPoints, submitVerdict, resolveDispute, mintReputation) go through the backend signer.

### Shared DB Tables
```sql
-- events (EventStore persistence)
-- Already handled by EventStore class

-- users (builder/organiser/maintainer profiles)
CREATE TABLE users (
  address TEXT PRIMARY KEY,
  role TEXT DEFAULT 'builder', -- builder, organiser, maintainer, awarder
  name TEXT,
  bio TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);
```

### Migration Path
1. Deploy new contracts (`ZeroLanceTaskEscrow`, `WaveFundingVault`)
2. Backend reads existing DB state and syncs to new contracts
3. Old contracts become no-op shims (or deleted)
4. Backend routes new traffic to new contracts
