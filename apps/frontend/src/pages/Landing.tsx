import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill } from "../components/Alden.js";
import type { EventMessage } from "../lib/types.js";

export default function Landing() {
  const { connected } = useAuth();
  const [released, setReleased] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<EventMessage[]>("/v1/events?limit=1&eventName=Released")
      .then((events) => { if (!cancelled && events.length) setReleased(events[0].payload?.reward ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <section className="zl-section" style={{ padding: "var(--spacing-112) 0 var(--spacing-80)" }}>
        <div className="zl-container" style={{ textAlign: "center" }}>
          <h1 className="zl-text-display" style={{ margin: 0, lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }}>
            Verified freelance,<br />without the <span style={{ color: "var(--color-sky-highlight)" }}>middleman</span>.
          </h1>
          <p className="zl-text-subheading" style={{ maxWidth: 640, margin: "24px auto 0", color: "var(--color-graphite)" }}>
            Post tasks, fund escrow, ship through GitHub. AI-verified verdicts release payment on 0G Chain — no fees, no disputes.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 40 }}>
            <Link to="/marketplace"><Button>Open Marketplace</Button></Link>
            <Link to="/login"><Button variant="ghost">Connect Wallet</Button></Link>
          </div>
        </div>
      </section>

      <section className="zl-section" style={{ padding: "var(--spacing-64) 0" }}>
        <div className="zl-container">
          <div className="zl-grid zl-grid--3" style={{ textAlign: "center" }}>
            <div className="zl-card">
              <div style={{ fontSize: 32, fontWeight: 600, color: "var(--color-ink-black)" }}>1</div>
              <div style={{ marginTop: 12, fontWeight: 500 }}>Post work</div>
              <div style={{ color: "var(--color-graphite)", marginTop: 8, fontSize: 14 }}>Create a task, attach a GitHub repo, fund escrow in USDC.</div>
            </div>
            <div className="zl-card">
              <div style={{ fontSize: 32, fontWeight: 600, color: "var(--color-ink-black)" }}>2</div>
              <div style={{ marginTop: 12, fontWeight: 500 }}>Builders ship</div>
              <div style={{ color: "var(--color-graphite)", marginTop: 8, fontSize: 14 }}>Freelancers claim, submit PRs, and pass AI + CI verification.</div>
            </div>
            <div className="zl-card">
              <div style={{ fontSize: 32, fontWeight: 600, color: "var(--color-ink-black)" }}>3</div>
              <div style={{ marginTop: 12, fontWeight: 500 }}>Get paid</div>
              <div style={{ color: "var(--color-graphite)", marginTop: 8, fontSize: 14 }}>Oracle-signed verdicts auto-release escrow. Earn on-chain reputation.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="zl-section zl-section--parchment" style={{ padding: "var(--spacing-80) 0" }}>
        <div className="zl-container" style={{ textAlign: "center" }}>
          <h2 className="zl-text-heading-lg" style={{ margin: 0, lineHeight: "var(--leading-heading-lg)", letterSpacing: "var(--tracking-heading-lg)" }}>
            Built for <span style={{ color: "var(--color-sky-highlight)" }}>builders</span>
          </h2>
          <p className="zl-text-body" style={{ maxWidth: 640, margin: "24px auto 0", color: "var(--color-graphite)" }}>
            Every completed task mints an ERC-7857 reputation NFT with encrypted portfolio data. Stake $ZERO for a verified badge that travels with you.
          </p>
          <div style={{ marginTop: 40, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Pill variant="accent">AI-Verified</Pill>
            <Pill>Escrow-Backed</Pill>
            <Pill variant="success">On-Chain Reputation</Pill>
            <Pill>0G Storage</Pill>
          </div>
        </div>
      </section>

      {released && (
        <section className="zl-section" style={{ padding: "var(--spacing-64) 0" }}>
          <div className="zl-container" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--color-graphite)", fontSize: 14 }}>Latest payout</p>
            <p style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>{released} USDC</p>
          </div>
        </section>
      )}
    </>
  );
}
