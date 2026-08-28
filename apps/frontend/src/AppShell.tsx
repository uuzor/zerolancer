import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "./context/AuthContext.js";
import { useConfig } from "./context/ConfigContext.js";

const NAV_ITEMS = [
  { to: "/marketplace", label: "Marketplace" },
  { to: "/tasks", label: "My Tasks" },
  { to: "/issues", label: "Issues" },
  { to: "/buildathons", label: "Buildathons" },
  { to: "/reputation", label: "Reputation" },
  { to: "/disputes", label: "Disputes" },
  { to: "/github", label: "GitHub" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { connected, principal, devMode } = useAuth();
  const config = useConfig();
  const location = useLocation();

  const hasWave = config.addresses.waveProgram && config.addresses.waveIssue && config.addresses.waveBuildathon;

  const nav = NAV_ITEMS.filter((item) => {
    if ((item.to === "/issues" || item.to === "/buildathons" || item.to === "/reputation") && !hasWave) return false;
    return true;
  });

  return (
    <div className="zl-app">
      <header className="zl-header">
        <Link to="/" className="zl-brand">
          <img src="/zerolance.svg" alt="ZeroLance" />
          <span>ZeroLance</span>
        </Link>
        <nav className="zl-nav">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={location.pathname.startsWith(item.to) ? "zl-nav-active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="zl-wallet" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {principal && <span className="zl-badge" style={{ fontSize: 11 }}>{principal}</span>}
          {devMode && <span className="zl-badge zl-badge--warning">Dev</span>}
          <ConnectButton />
        </div>
      </header>

      <main className="zl-main">{children}</main>

      <footer className="zl-footer">
        <span>ZeroLance · 0G Galileo · AI-Verified Escrow</span>
      </footer>
    </div>
  );
}
