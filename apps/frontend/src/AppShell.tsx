import { type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="zl-app">
      <header className="zl-header">
        <div className="zl-brand">
          <img src="/zerolance.svg" alt="ZeroLance" width={28} height={28} />
          <span>ZeroLance</span>
        </div>
        <nav className="zl-nav">
          <a href="/marketplace">Marketplace</a>
          <a href="/tasks">My Tasks</a>
          <a href="/reputation">Reputation</a>
        </nav>
        <div className="zl-wallet">{/* RainbowKit ConnectButton injected */}</div>
      </header>
      <main className="zl-main">{children}</main>
      <footer className="zl-footer">
        <span>ZeroLance · 0G Chain · AI-Verified Escrow</span>
      </footer>
    </div>
  );
}
