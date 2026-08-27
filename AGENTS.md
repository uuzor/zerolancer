# ZeroLancer — Agent Memory

## Project Overview
ZeroLance is a decentralized freelance marketplace on 0G Chain (Galileo testnet, chain ID 16602).
Built using axiom-protocol as reference. MVP scope: smart contracts, backend, GitHub integrations.

## Architecture
- Monorepo: `packages/config` (shared config/env), `apps/backend` (Express + WebSocket server)
- Smart contracts deployed to 0G Galileo testnet — addresses in `docs/deployments/galileo.json`
- Backend uses `tsx` for on-the-fly TS transpilation (no build step needed for dev)

## Key Commands
- Start backend: `cd apps/backend && set -a && source ../../.env && set +a && node --import tsx src/index.ts`
- Run tests: `cd apps/backend && set -a && source ../../.env && set +a && node --import tsx --test <test-file>`
- Rebuild config package: `cd packages/config && npx tsc`
- Rebuild backend types: `cd apps/backend && npx tsc`

## Environment
- Auth disabled in dev via `ZERO_DISABLE_AUTH=true`
- `ZERO_API_KEY`: App-level API key (used as Bearer token for service-account mode)
- `ZERO_GITHUB_TOKEN`: GitHub PAT for service-account GitHub API access
- `ZERO_COMPUTE_API_KEY`: 0G compute router key (valid for models list; chat requires inference credits)
- `ZERO_COMPUTE_BASE_URL`: Must be `https://router-api.0g.ai/v1` (0G compute router endpoint)
- `ZERO_COMPUTE_MODEL`: Must be `0gm-1.0-35b-a3b` (NOT meta-llama/...; that model doesn't exist on 0G)
- `ZERO_EVM_RPC`: Must be `https://evmrpc-testnet.0g.ai` (Galileo testnet, NOT mainnet `evmrpc.0g.ai`)
- `ZERO_CHAIN_ID`: Must be `16602` (Galileo testnet, NOT `16661` which is mainnet)
- `ZERO_TEE_SIGNER_PK`: Oracle signing key — may be bare hex (64 chars) or 0x-prefixed; env schema normalizes both
- `ZERO_TEE_SIGNER_ADDRESS`: Derived from ZERO_TEE_SIGNER_PK (0x3E99444912Ff7549A1581Baf0b0C8EB1e930729D)

## Oracle (TEE Signer)
- Start: `cd apps/oracle && set -a && source ../../.env && set +a && ZERO_DISABLE_AUTH=true node --import tsx src/index.ts`
- Runs on port 8787, signs EIP-712 verdicts for the verification pipeline
- Simulated TEE mode (Node.js with cleartext key) — NOT Intel TDX/SEV

## Testing

### Integration Tests (require live servers + deployed contracts)
All integration tests live in `apps/backend/src/` and require:
1. Backend running on port 3000
2. Oracle running on port 8787
3. Contracts deployed to 0G Galileo testnet
4. `.env` sourced with `set -a && source ../../.env && set +a`

Run all integration tests:
```bash
cd apps/backend
set -a && source ../../.env && set +a
node --import tsx --test \
  src/workflow/routes.integration.test.ts \
  src/workflow/full-workflow.integration.test.ts \
  src/github/routes.integration.test.ts \
  src/github/issues.integration.test.ts \
  src/compute/routes.integration.test.ts
```

Test suites (54 tests total, all passing):
- `src/workflow/routes.integration.test.ts` (16 tests) — Smart contract workflow: task create/assign/submit, escrow approve/deposit/refund, verification (AI+CI+oracle), disputes, reputation
- `src/workflow/full-workflow.integration.test.ts` (15 tests) — End-to-end: task→connect repo→create issue→assign→submit→escrow→verify→dispute→reputation→cleanup
- `src/github/routes.integration.test.ts` (10 tests) — GitHub REST endpoints: /me, /repos, /connect, /task/:id/repo, /task/:id/pr, /task/:id/sync
- `src/github/issues.integration.test.ts` (9 tests) — GitHub issue lifecycle: list, create, get, close
- `src/compute/routes.integration.test.ts` (4 tests) — 0G compute: models list, chat (may 401 if no credits)

### Notes
- Tests skip automatically if required env vars are missing (uses `describe.skip`)
- GitHub issue tests create real issues in symulacr/axiom-protocol repo; cleaned up (closed) in after() hook
- Verification pipeline: AI scoring may fail (0G compute credits); CI clone may fail (no real PR); both handled as soft-fail artifacts
- BigInt fields in verification responses are serialized as strings (JSON.stringify can't handle BigInt)

## GitHub Integration
- `resolveAccount()` in `apps/backend/src/routers/github.ts` has PAT service-account fallback:
  when Bearer token matches `ZERO_API_KEY` or `ZERO_CLIENT_API_KEY`, it synthesizes a
  service-account using `ZERO_GITHUB_TOKEN` PAT (bypasses OAuth flow for server-to-server use)
- Routes: `/v1/github/me`, `/v1/github/repos`, `/v1/github/connect`, `/v1/github/task/:id/repo`,
  `/v1/github/task/:id/pr`, `/v1/github/task/:id/sync`

## 0G Compute Integration
- `apps/backend/src/routers/compute.ts` — REST endpoints for 0G inference
- Routes: `/v1/compute/models` (GET), `/v1/compute/chat` (POST)
- Uses OpenAI-compatible SDK via `apps/backend/src/compute/index.ts`
- Default model: `0gm-1.0-35b-a3b` (0G in-house model)
- Note: chat completions require 0G account inference credits; models list is free

## Wave Funding (Buildathon + Issue)
- Contacts: `ZeroLanceWaveProgram`, `ZeroLanceWaveIssue`, `ZeroLanceWaveBuildathon`
  in `apps/contracts/src/zerolancewave/`; contract tests in
  `apps/contracts/test/WaveFunding.t.sol` (14 passing via `forge test`).
- ABIs: hand-authored, readable-name files in `packages/config/src/abis/`
  (`zeroLanceWaveProgram.ts`, `zeroLanceWaveIssue.ts`, `zeroLanceWaveBuildathon.ts`,
  `pointsLedger.ts`) re-exported as `ZEROLANCE_WAVE_*_ABI` /
  `ZEROLANCE_POINTS_LEDGER_ABI` from `packages/config/src/abis/index.ts`.
- Client: `apps/backend/src/wave/client.ts` (`WaveClient`) � reads + signer writes.
  Constructed in `server.ts` config only when all three `ZERO_WAVE_*_ADDRESS` env vars
  are set (optional until contracts are deployed); otherwise `waveClient` is `null`.
- Routers: `apps/backend/src/routers/wave.ts` � `/v1/wave/program/:id`,
  `/v1/wave/program/:id/wave/:waveId`, `/v1/wave/program/:id/meta`,
  `/v1/wave/program/:id/claimable`, `/v1/wave/issue/:id`,
  `/v1/wave/buildathon/submission/:id`, plus signer-gated deposit/open-wave/claim/finalize.
  Returns `WAVE_NOT_CONFIGURED` (503) when addresses absent. BigInts serialized via
  `bigintReplacer`.
- Three wave indexers are registered in `server.ts` (wave-program/issue/buildathon) but
  skip when their address env vars are unset.

## 0G Storage Integration
- `apps/backend/src/storage/service.ts` (`StorageService`) � uploads artifacts to 0G
  Storage via `ZeroGStorage`, or deterministic in-memory fallback (`InMemoryStorage`,
  keccak addressable) when no signer/storage RPC. `backend` is `"0g" | "in-memory"`.
- Env: `ZERO_STORAGE_RPC` (defaults via `resolveStorageRpc()`), `ZERO_EVM_RPC`, and the
  runtime/operator PK becomes the signer. Init in `server.ts` before the DA publisher.
- Routers: `apps/backend/src/routers/storage.ts` � `/v1/storage/upload-json`, `/v1/storage/download/:rootHash`, `/v1/storage/status`.

## DA Publisher (event anchoring)
- `apps/backend/src/da/publisher.ts` (`DaPublisher`) � batches Events appended through the
  `EventStore` and anchors each batch as a content-addressed 0G Storage blob. Produces a
  merkle-style `batchRoot` over sorted (eventName, payload) leaves; the blob is retrievable
  by its 0G content `rootHash`.
- `events/store.ts` gains `setDaPublisher()` (wired in `server.ts`), a DA enqueue hook in
  `append()`, and `daCommitments()` accessor.
- Routers: `apps/backend/src/routers/da.ts` � `/v1/da/publish`, `/v1/da/commitments`, `/v1/da/summary`.
- Env: `ZERO_DA_MAX_BATCH_EVENTS` (default 50), `ZERO_DA_FLUSH_INTERVAL_MS` (default 5000).
- Unit tests: `apps/backend/src/da/publisher.test.ts` (StorageService + DaPublisher,
  in-memory backend).
- `DaCommitment` exposes both `batchRoot` (verifiable commitment) and `rootHash` (blob key).

## Known Issues
- ABI warnings for struct fragments (`struct Verdict`, `struct Task`, etc.) — non-fatal, viem
  parser doesn't accept inline struct definitions in ABI fragments
- `ZERO_COMPUTE_API_KEY` can list models but returns 401 on chat — external account credits issue

## Wave Funding (Buildathon + Issue)
- Contracts: `ZeroLanceWaveProgram`, `ZeroLanceWaveIssue`, `ZeroLanceWaveBuildathon`
  in `apps/contracts/src/zerolancewave/`; tests in `apps/contracts/test/WaveFunding.t.sol`.
- ABIs: hand-authored readable-name files in `packages/config/src/abis/`
  re-exported as `ZEROLANCE_WAVE_*_ABI` / `ZEROLANCE_POINTS_LEDGER_ABI`.
- Client: `apps/backend/src/wave/client.ts` (`WaveClient`). Built in `server.ts` only when
  all three `ZERO_WAVE_*_ADDRESS` env vars are set; else `waveClient` is `null`.
- Routers: `apps/backend/src/routers/wave.ts` — `/v1/wave/program/:id`,
  `/v1/wave/program/:id/wave/:waveId`, `/v1/wave/program/:id/meta`,
  `/v1/wave/program/:id/claimable`, `/v1/wave/issue/:id`,
  `/v1/wave/buildathon/submission/:id`, plus signer-gated deposit/open-wave/claim/finalize.
  Returns 503 `WAVE_NOT_CONFIGURED` when addresses are absent. BigInts via `bigintReplacer`.
- Three wave indexers registered in `server.ts`; skipped when their env addresses are unset.

## 0G Storage Integration
- `apps/backend/src/storage/service.ts` (`StorageService`) — uploads artifacts via
  `ZeroGStorage` (real 0G when a signer + storage RPC exist), else deterministic in-memory
  fallback (`InMemoryStorage`, keccak addressable). `backend` is `"0g" | "in-memory"`.
- Routers: `apps/backend/src/routers/storage.ts` — `/v1/storage/upload-json`,
  `/v1/storage/download/:rootHash`, `/v1/storage/status`.

## DA Publisher (event anchoring)
- `apps/backend/src/da/publisher.ts` (`DaPublisher`) — batches Events from the `EventStore`
  into content-addressed 0G Storage blobs, producing a merkle-style `batchRoot` over sorted
  (eventName, payload) leaves. `DaCommitment` exposes both `batchRoot` (commitment) and
  `rootHash` (blob retrieval key).
- `events/store.ts` gains `setDaPublisher()`, a DA enqueue hook in `append()`, and
  `daCommitments()`.
- Routers: `apps/backend/src/routers/da.ts` — `/v1/da/publish`,
  `/v1/da/commitments`, `/v1/da/summary`.
- Env: `ZERO_DA_MAX_BATCH_EVENTS` (50), `ZERO_DA_FLUSH_INTERVAL_MS` (5000).
- Unit tests: `apps/backend/src/da/publisher.test.ts` (StorageService + DaPublisher, in-memory).
