export declare function publicKeyUncompressedFromPrivate(privateKey: Uint8Array): Uint8Array<ArrayBufferLike>;
export declare function pubKeyToAddress(uncompressed: Uint8Array): `0x${string}`;
export declare function deriveRawPubkeyFromHex(privateKeyHex: string): Uint8Array<ArrayBufferLike>;
export declare const deriveUncompressedPubkeyFromHex: typeof deriveRawPubkeyFromHex;
export declare function sealKeyForReceiver(receiverPubkey64: Uint8Array, dataEncryptionKey: Uint8Array): Uint8Array<ArrayBufferLike>;
export declare function unsealKeyForReceiver(receiverPrivateKey: Uint8Array, sealedKey: Uint8Array): Uint8Array<ArrayBufferLike>;
//# sourceMappingURL=keys.d.ts.map