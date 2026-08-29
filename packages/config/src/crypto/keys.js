import { encrypt, decrypt } from "eciesjs";
import { secp256k1 } from "ethereum-cryptography/secp256k1";
import { keccak256 } from "ethereum-cryptography/keccak";
export function publicKeyUncompressedFromPrivate(privateKey) {
    const pub = secp256k1.getPublicKey(privateKey, false);
    return pub.length === 65 ? pub.subarray(1) : pub;
}
export function pubKeyToAddress(uncompressed) {
    if (uncompressed.length !== 64)
        throw new Error("Uncompressed pubkey must be 64 bytes (X||Y)");
    const hash = keccak256(new Uint8Array(uncompressed));
    return ("0x" + Buffer.from(hash).toString("hex").slice(-40));
}
export function deriveRawPubkeyFromHex(privateKeyHex) {
    return publicKeyUncompressedFromPrivate(Uint8Array.from(Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex")));
}
export const deriveUncompressedPubkeyFromHex = deriveRawPubkeyFromHex;
function toCompressed(uncompressedOrFull) {
    if (uncompressedOrFull.length === 33)
        return uncompressedOrFull;
    const full = uncompressedOrFull.length === 64
        ? Buffer.concat([new Uint8Array([0x04]), uncompressedOrFull])
        : uncompressedOrFull;
    if (full.length !== 65)
        throw new Error("Pubkey must be 64 (X||Y) or 33 (compressed) or 65 (0x04||X||Y) bytes");
    const point = secp256k1.ProjectivePoint.fromHex(full);
    return point.toRawBytes(true);
}
/// ECIES-seal a DEK (data encryption key) to a receiver's uncompressed pubkey.
export function sealKeyForReceiver(receiverPubkey64, dataEncryptionKey) {
    return encrypt(toCompressed(receiverPubkey64), dataEncryptionKey);
}
export function unsealKeyForReceiver(receiverPrivateKey, sealedKey) {
    return decrypt(receiverPrivateKey, sealedKey);
}
//# sourceMappingURL=keys.js.map