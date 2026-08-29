export const ARISTOTLE_CHAIN_ID = 16661;
export const GALILEO_CHAIN_ID = 16602;
const _OG_NETWORKS = {
    16661: {
        name: "aristotle",
        chainId: 16661,
        evmRpc: "https://evmrpc.0g.ai",
        storageRpc: "https://indexer-storage-turbo.0g.ai",
        computeRouterUrl: "https://router-api.0g.ai/v1",
        blockExplorer: "https://chainscan.0g.ai",
    },
    16602: {
        name: "galileo",
        chainId: 16602,
        evmRpc: "https://evmrpc-testnet.0g.ai",
        storageRpc: "https://indexer-storage-testnet-turbo.0g.ai",
        computeRouterUrl: "https://router-api-testnet.0g.ai/v1",
        blockExplorer: "https://chainscan-testnet.0g.ai",
    },
};
export const OG_NETWORKS = _OG_NETWORKS;
export function pickOGNetwork(chainId) {
    return OG_NETWORKS[chainId] ?? null;
}
function envVar(...keys) {
    if (typeof process === "undefined" || !process.env)
        return undefined;
    for (const key of keys) {
        const val = process.env[key];
        if (val)
            return val;
    }
    return undefined;
}
export function resolveRpcUrl(chainId) {
    const varVal = envVar("ZERO_EVM_RPC", "OG_RPC_URL", "RPC_URL");
    if (varVal)
        return varVal;
    const network = chainId ? pickOGNetwork(chainId) : null;
    return network?.evmRpc ?? "https://evmrpc.0g.ai";
}
export function resolveStorageRpc(chainId) {
    const varVal = envVar("ZERO_STORAGE_RPC", "OG_STORAGE_RPC");
    if (varVal)
        return varVal;
    const network = chainId ? pickOGNetwork(chainId) : null;
    return network?.storageRpc ?? "https://indexer-storage-turbo.0g.ai";
}
export function resolveBlockExplorerUrl(chainId) {
    const network = chainId ? pickOGNetwork(chainId) : null;
    return network?.blockExplorer ?? "https://chainscan.0g.ai";
}
import { defineChain } from "viem";
export const zeroGMainnet = defineChain({
    id: ARISTOTLE_CHAIN_ID,
    name: "0G Aristotle",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: { default: { http: [resolveRpcUrl()] } },
});
//# sourceMappingURL=networks.js.map