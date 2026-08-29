import { getDefaultConfig, RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { defineChain } from "viem";
import { AuthProvider } from "./context/AuthContext.js";
import { ConfigProvider } from "./context/ConfigContext.js";
import { AppShell } from "./AppShell.js";
import { AppRoutes } from "./routes.js";
import "./styles.css";

const queryClient = new QueryClient();

const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G Scan", url: "https://chainscan-testnet.0g.ai" } },
});

const wagmiConfig = getDefaultConfig({
  appName: "ZeroLance",
  projectId: "zerolance",
  chains: [galileo],
  ssr: false,
});

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <ConfigProvider>
              <AuthProvider>
                <AppShell><AppRoutes /></AppShell>
              </AuthProvider>
            </ConfigProvider>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
