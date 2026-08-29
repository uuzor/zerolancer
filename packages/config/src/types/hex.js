import { z } from "zod";
export const hexSchema = z
    .string()
    .regex(/^0x[0-9a-fA-F]*$/, "must be 0x-prefixed hex");
/// Alias kept for parity with the axiom-protocol env schemas (private-key fields).
export const hexString = hexSchema;
export const hexViem = hexSchema.transform((v) => v);
export const addressViem = z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 40-hex address")
    .transform((v) => v);
export const bytes32Viem = z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "must be 0x + 64 hex chars")
    .transform((v) => v);
/// Convert any 0x-hex or bare hex string to a viem `0x${string}` (no validation).
export function toViemHex(value) {
    const v = value.trim();
    return (v.startsWith("0x") ? v : `0x${v}`);
}
//# sourceMappingURL=hex.js.map