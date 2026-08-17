import { getAddress } from "viem";

export type AddressName =
  | "mockUsdc"
  | "zeroToken"
  | "teeVerifier"
  | "taskRegistry"
  | "escrowVault"
  | "arbitration"
  | "reputationNft";

const ENV_VAR_NAMES: Record<AddressName, string[]> = {
  mockUsdc: ["ZERO_MOCK_USDC_ADDRESS", "ZERO_PAYMENT_TOKEN", "USDC_ADDRESS"],
  zeroToken: ["ZERO_TOKEN_ADDRESS", "ZERO_ZERO_TOKEN_ADDRESS"],
  teeVerifier: ["ZERO_TEE_VERIFIER_ADDRESS", "ZERO_TEE_VERIFIER"],
  taskRegistry: ["ZERO_TASK_REGISTRY_ADDRESS", "TASK_REGISTRY_ADDRESS"],
  escrowVault: ["ZERO_ESCROW_VAULT_ADDRESS", "ESCROW_VAULT_ADDRESS"],
  arbitration: ["ZERO_ARBITRATION_ADDRESS", "ARBITRATION_ADDRESS"],
  reputationNft: ["ZERO_REPUTATION_NFT_ADDRESS", "REPUTATION_NFT_ADDRESS"],
};

const ADDRESS_NAMES = Object.keys(ENV_VAR_NAMES) as AddressName[];

export function resolveAddress(
  name: AddressName,
  env: Record<string, unknown>,
): `0x${string}` {
  const varNames = ENV_VAR_NAMES[name];
  for (const varName of varNames) {
    const val = env[varName];
    if (typeof val === "string" && val.trim()) {
      try {
        return getAddress(val.trim());
      } catch {
        throw new Error(
          `Invalid address for "${name}" in ${varName}="${val}" (must be 0x + 40 hex chars)`,
        );
      }
    }
  }
  throw new Error(
    `Missing deployed-address env var for "${name}" — set one of: ${varNames.join(", ")}`,
  );
}

export function getAddresses(
  env: Record<string, unknown> = typeof process !== "undefined" && process.env
    ? process.env
    : {},
): Record<AddressName, `0x${string}`> {
  return Object.fromEntries(
    ADDRESS_NAMES.map((name) => [name, resolveAddress(name, env)]),
  ) as Record<AddressName, `0x${string}`>;
}
