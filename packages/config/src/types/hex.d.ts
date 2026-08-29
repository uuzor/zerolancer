import { z } from "zod";
export declare const hexSchema: z.ZodString;
export declare const hexString: z.ZodString;
export declare const hexViem: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare const addressViem: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare const bytes32Viem: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare function toViemHex(value: string): `0x${string}`;
//# sourceMappingURL=hex.d.ts.map