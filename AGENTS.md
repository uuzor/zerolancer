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

## Known Issues
- ABI warnings for struct fragments (`struct Verdict`, `struct Task`, etc.) — non-fatal, viem
  parser doesn't accept inline struct definitions in ABI fragments
- `ZERO_COMPUTE_API_KEY` can list models but returns 401 on chat — external account credits issue
