export type AddressName = "mockUsdc" | "zeroToken" | "teeVerifier" | "taskRegistry" | "escrowVault" | "arbitration" | "reputationNft";
export declare function resolveAddress(name: AddressName, env: Record<string, unknown>): `0x${string}`;
export declare function getAddresses(env?: Record<string, unknown>): Record<AddressName, `0x${string}`>;
//# sourceMappingURL=addresses.d.ts.map