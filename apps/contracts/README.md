# @zerolance/contracts

ZeroLance smart contracts — Foundry / Solidity 0.8.20 / OpenZeppelin 5.0.2 / 0G Chain.

## Contracts

### Core (task marketplace)

| Contract | Purpose |
|---|---|
| `MockUSDC` | Devnet ERC-20 payment token for escrow. |
| `ZeroLanceToken` ($ZERO) | Governance/utility token: arbiter rewards, staking, task boosting/burn. |
| `ZeroLanceTeeVerifier` | EIP-712 verifier for oracle-signed AI verdicts (trust anchor for auto-release) and ERC-7857 reputation metadata proofs. |
| `ZeroLanceTaskRegistry` | Immutable task specs (specHash on-chain, encrypted spec on 0G Storage). |
| `ZeroLanceTaskEscrow` | Funds-only ERC-20 vault. Holds USDC per task, releases on a verified verdict via the TaskVerifier, refunds on cancellation. No deliverable/verdict logic. |
| `ZeroLanceTaskVerifier` | Task lifecycle orchestrator. Owns `submitDeliverable`, `submitVerdict` (relays EIP-712 signed verdicts), dispute escalation, and reputation minting. The escrow trusts this contract alone for releases. |
| `ZeroLanceArbitration` | Multi-sig dispute resolution by staked-freelancer arbiters; $ZERO rewards. |
| `ZeroLanceReputationNFT` | ERC-7857-style reputation receipt NFT; portable encrypted portfolio; $ZERO verified badge. |

### Wave funding (split into escrow + verifier + two mode contracts)

| Contract | Purpose |
|---|---|
| `WaveFundingEscrow` | Funds-only vault for any wave program. Holds a single ERC-20 (USDC) and tracks per-program `pooled`, `distributed`, and `waveBudget` accounting. The verifier is the sole privileged caller. |
| `WaveFundingVerifier` | State + rules for wave programs: owns programs, waves, projects, awarders, points. Calls the escrow for budget locks and claim payouts. No token custody. |
| `ZeroLanceOssWave` | OSS mode operations: accepted repos, maintainer-posted issues, builder claim/submit, merge-confirm awards (routes to verifier). |
| `ZeroLanceBuildathonWave` | Buildathon mode: team registration, per-wave submissions, judge + community scoring (routes to verifier). |
| `PointsLedger` | Non-upgradeable, shared points accounting per wave. Frozen at wave close. Owned by the verifier. |

## Build

```bash
forge install foundry-rs/forge-std@v1.16.1 --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.2 --no-git
pnpm build   # forge build + generate ABIs
pnpm test
```

## Deploy

```bash
DEPLOYER_PK=0x... ZERO_NETWORK=galileo pnpm deploy:galileo
DEPLOYER_PK=0x... ZERO_NETWORK=aristotle pnpm deploy:mainnet
```

Two deployment manifests are written:

- `docs/deployments/<network>.json` — core (task marketplace) contracts.
- `docs/deployments/<network>-wave.json` — wave funding suite.

## Architecture

See `docs/ARCHITECTURE.md` for the feature→contract mapping and the full protocol design.

## Notes

- All upgradeable contracts use UUPS proxies with ERC-7201 namespaced storage and 1-day timelocks on sensitive rotations (verifier signer, protocol treasury).
- `WaveFundingEscrow` and `ZeroLanceTaskEscrow` are **funds-only**: they never call out to business logic. The verifier/orchestrator contracts drive every privileged move.
- `ZeroLanceTaskVerifier.submitVerdict` is callable by the configured TEE verifier signer (relayed via `ZeroLanceTeeVerifier.verifyVerdict`); the on-chain verifier is the trust anchor.
- `ZeroLanceReputationNFT` stores the encrypted-metadata `dataHash` on-chain (ERC-7857 IDataStorage pattern); the oracle re-keys the encrypted blob on transfer and calls `updateMetadata`. The full `iTransfer` proof flow (IERC7857DataVerifier) layers on `ZeroLanceTeeVerifier`.
