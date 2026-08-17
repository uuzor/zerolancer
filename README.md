# ZeroLance

**ZeroLance** is a decentralized freelance marketplace on [0G Chain](https://0g.ai)
that replaces Upwork's 20% fees with **AI-verified escrow**, **GitHub-native
workflows**, and **on-chain reputation NFTs**. Built using
[`axiom-protocol`](https://github.com/symulacr/axiom-protocol) as a reference
architecture.

## Why

Upwork takes 20%+ per gig and decides disputes opaquely. ZeroLance replaces that
trust model with code:

- **2.5% flat fee** — enforced on-chain in the escrow contract.
- **AI-verified release** — an oracle runs the deliverable through CI + AI scoring,
  signs an EIP-712 verdict, and the vault auto-releases USDC when it passes.
- **GitHub-native** — freelancers submit PRs; the runner replays CI deterministically.
- **On-chain reputation** — ERC-7857-style NFTs store encrypted portfolio data on
  0G Storage, portable across marketplaces. Stake $ZERO for a verified badge.
- **Dispute resolution** — staked-freelancer arbiters vote; $ZERO rewards honest
  arbiters and slashes dishonest ones.

## Architecture

```
zerolancer/
├── apps/
│   ├── contracts/   Solidity ^0.8.20 · Foundry · OpenZeppelin 5 · 0G Chain (Cancun)
│   ├── backend/     Express + WS orchestration engine (escrow, verify, indexer, GitHub)
│   ├── oracle/      TEE signer service (EIP-712 verdicts + ERC-7857 re-keying)
│   └── frontend/    Vite + React + wagmi + RainbowKit marketplace dashboard
├── packages/
│   ├── config/      networks, ABIs, EIP-712, crypto, 0G Storage, auth middleware
│   └── shared/      domain helpers (spec hashing, score computation)
└── docs/
    └── ARCHITECTURE.md
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full design.

## Quickstart

```bash
pnpm install

# Build the shared packages first
pnpm --filter @zerolance/config build
pnpm --filter @zerolance/shared build

# Build & test contracts
cd apps/contracts
forge install foundry-rs/forge-std@v1.16.1 --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.2 --no-git
forge build
forge test
cd ../..

# Run oracle (needs ZERO_TEE_SIGNER_PK + ZERO_TEE_VERIFIER_ADDRESS)
pnpm --filter @zerolance/oracle dev

# Run backend (needs deployed addresses + ZERO_ORACLE_URL)
pnpm --filter @zerolance/backend dev

# Run frontend
pnpm --filter @zerolance/frontend dev
```

Copy `.env.example` → `.env` and fill in the deployed addresses after running
`pnpm --filter @zerolance/contracts deploy:galileo`.

## Contracts

| Contract | Role |
|---|---|
| `ZeroLanceToken` ($ZERO) | Governance/utility: arbiter rewards, staking, task boosting/burn. |
| `ZeroLanceTeeVerifier` | EIP-712 verifier — the on-chain trust anchor for AI verdicts. |
| `ZeroLanceTaskRegistry` | Immutable task specs (specHash on-chain, encrypted spec on 0G Storage). |
| `ZeroLanceEscrowVault` | USDC escrow; auto-releases on a `passed` verdict; 2.5% fee split. |
| `ZeroLanceArbitration` | Multi-sig dispute resolution by staked-freelancer arbiters. |
| `ZeroLanceReputationNFT` | ERC-7857-style reputation NFT; portable encrypted portfolio; verified badge. |
| `MockUSDC` | Devnet payment token. |

## AI-Verified Escrow flow

```
Client ──(deposit USDC)──▶ EscrowVault
                              │
Freelancer ──(PR)──▶ Backend ◀─┘
                    │
        ┌───────────┴───────────┐
   GitHubRunner            AI scorer (0G Compute)
   (lint/test/coverage)    (LLM review)
        └───────────┬───────────┘
                    ▼
           VerificationResult
                    │
             Oracle.signVerdict()  ──▶ EIP-712 signature
                    │
             EscrowVault.submitVerdict(verdict)
                    │
          passed? ──┴── failed?
           │              │
    release USDC      refund + dispute
    + mint rep NFT    (arbiters vote)
```

## Deployment

- **Backend / Oracle**: Railway (`apps/backend/railway.json`, `apps/oracle/railway.json`)
- **Frontend**: Vercel (`apps/frontend/vercel.json`)
- **Contracts**: 0G Chain Galileo (testnet) / Aristotle (mainnet)

## Status

Scaffold + reference implementation. Contracts compile under Foundry; backend,
oracle, and frontend are wired against the contract ABIs. Not audited.
