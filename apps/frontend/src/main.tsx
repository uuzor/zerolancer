import { getDefaultConfig, RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { zeroGMainnet } from "@zerolance/config";

import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";
import { AppShell } from "./AppShell.js";
import { Marketplace } from "./pages/Marketplace.js";

const queryClient = new QueryClient();

const wagmiConfig = getDefaultConfig({
  appName: "ZeroLance",
  projectId: "zerolance",
  chains: [zeroGMainnet],
  ssr: false,
});

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppShell>
            <Marketplace />
          </AppShell>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
