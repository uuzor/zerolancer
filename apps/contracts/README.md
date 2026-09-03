# @zerolance/contracts

ZeroLance smart contracts — Foundry / Solidity 0.8.20 / OpenZeppelin 5.0.2 / 0G Chain.

## Contracts

### Core (task marketplace)

| Contract | Purpose |
|---|---|
| `MockUSDC` | Devnet ERC-20 payment token for escrow. |
| `ZeroLanceToken` ($ZERO) | Governance/utility token: staking, task boosting/burn. |
| `ZeroLanceTeeVerifier` | EIP-712 verifier for oracle-signed AI verdicts (trust anchor for auto-release) and ERC-7857 reputation metadata proofs. |
| `ZeroLanceTaskRegistry` | Immutable task specs (specHash on-chain, encrypted spec on 0G Storage). |
| `ZeroLanceTaskEscrow` | Task escrow + AI verification. Holds USDC per task, verifies EIP-712 verdicts, releases escrow, resolves disputes, mints reputation. Backend signer is the privileged caller for release/resolve/mint. |
| `ZeroLanceReputationNFT` | ERC-7857-style reputation receipt NFT; portable encrypted portfolio; $ZERO verified badge. |

### Wave funding (single contract)

| Contract | Purpose |
|---|---|
| `WaveFundingVault` | Wave escrow + points + distribution. Single contract for all wave programs (OSS + buildathon modes). Holds ERC-20 funds, tracks points, distributes pro-rata. Backend signer sets points; anyone can claim. |

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
- `docs/deployments/<network>-wave.json` — wave funding vault.

## Architecture

See `docs/ARCHITECTURE.md` for the feature→contract mapping and the full protocol design.

## Notes

- All upgradeable contracts use UUPS proxies with ERC-7201 namespaced storage and 1-day timelocks on sensitive rotations (verifier signer, protocol treasury).
- `ZeroLanceTaskEscrow` absorbs verifier + dispute logic: the backend signer is the privileged caller for `release`, `resolveDispute`, and `mintReputation`.
- `WaveFundingVault` replaces the old 5-contract wave suite (WaveFundingEscrow + WaveFundingVerifier + PointsLedger + ZeroLanceOssWave + ZeroLanceBuildathonWave) with a single contract.
- All state machines (task lifecycle, disputes, wave programs, projects, issues, builders) live in the backend DB. Contracts are dumb payout routers.
