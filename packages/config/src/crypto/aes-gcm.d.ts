export interface EncryptedPayload {
    iv: Uint8Array;
    ciphertext: Uint8Array;
    authTag: Uint8Array;
}
export declare function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): EncryptedPayload;
export declare function aesGcmDecrypt(key: Uint8Array, payload: EncryptedPayload): Uint8Array;
export declare function concatEncrypted(payload: EncryptedPayload): Uint8Array<ArrayBuffer>;
export declare function parseEncrypted(blob: Uint8Array): {
    iv: Uint8Array<ArrayBufferLike>;
    ciphertext: Uint8Array<ArrayBufferLike>;
    authTag: Uint8Array<ArrayBufferLike>;
};
//# sourceMappingURL=aes-gcm.d.ts.map