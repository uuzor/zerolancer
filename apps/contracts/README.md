# @zerolance/contracts

ZeroLance smart contracts — Foundry / Solidity 0.8.20 / OpenZeppelin 5.0.2 / 0G Chain.

## Contracts

| Contract | Purpose |
|---|---|
| `MockUSDC` | Devnet ERC-20 payment token for escrow. |
| `ZeroLanceToken` ($ZERO) | Governance/utility token: arbiter rewards, staking, task boosting/burn. |
| `ZeroLanceTeeVerifier` | EIP-712 verifier for oracle-signed AI verdicts (trust anchor for auto-release). |
| `ZeroLanceTaskRegistry` | Immutable task specs (specHash on-chain, encrypted spec on 0G Storage). |
| `ZeroLanceEscrowVault` | ERC-20 escrow; auto-releases USDC on a `passed` verdict (2–3% fee); streaming-capable. |
| `ZeroLanceArbitration` | Multi-sig dispute resolution by staked-freelancer arbiters; $ZERO rewards. |
| `ZeroLanceReputationNFT` | ERC-7857-style reputation receipt NFT; portable encrypted portfolio; $ZERO verified badge. |

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

Deployment manifest is written to `docs/deployments/<network>.json`.

## Architecture

See `docs/ARCHITECTURE.md` for the feature→contract mapping and the full protocol design.

## Notes

- All upgradeable contracts use UUPS proxies with ERC-7201 namespaced storage and 1-day timelocks on sensitive rotations (verifier signer, protocol treasury).
- `ZeroLanceEscrowVault.submitVerdict` is permissionless: anyone may relay an oracle-signed verdict; the on-chain verifier is the trust anchor.
- `ZeroLanceReputationNFT` stores the encrypted-metadata `dataHash` on-chain (ERC-7857 IDataStorage pattern); the oracle re-keys the encrypted blob on transfer and calls `updateMetadata`. The full `iTransfer` proof flow (IERC7857DataVerifier) layers on `ZeroLanceTeeVerifier`.
