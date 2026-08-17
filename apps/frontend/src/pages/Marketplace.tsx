export function Marketplace() {
  return (
    <div>
      <section className="zl-hero">
        <h1>Decentralized freelance, verified by AI.</h1>
        <p>
          ZeroLance replaces Upwork's 20% fees with AI-verified escrow on 0G Chain.
          Stake $ZERO, ship work through GitHub, earn on-chain reputation NFTs.
        </p>
      </section>

      <section className="zl-stats">
        <div className="zl-stat">
          <div className="zl-stat-value">2.5%</div>
          <div className="zl-stat-label">Platform fee</div>
        </div>
        <div className="zl-stat">
          <div className="zl-stat-value">USDC</div>
          <div className="zl-stat-label">Escrow token</div>
        </div>
        <div className="zl-stat">
          <div className="zl-stat-value">0G</div>
          <div className="zl-stat-label">Chain</div>
        </div>
        <div className="zl-stat">
          <div className="zl-stat-value">AI</div>
          <div className="zl-stat-label">Verified release</div>
        </div>
      </section>

      <section className="zl-grid">
        <div className="zl-card">
          <h3>How it works</h3>
          <ol style={{ paddingLeft: 20, color: "var(--zl-text-dim)" }}>
            <li>Client deposits USDC into the escrow contract.</li>
            <li>Freelancer ships via a GitHub PR.</li>
            <li>AI verifies CI + quality, signs an EIP-712 verdict.</li>
            <li>Escrow auto-releases USDC on a passed verdict.</li>
            <li>Freelancer earns a portable reputation NFT.</li>
          </ol>
        </div>
        <div className="zl-card">
          <h3>Open tasks</h3>
          <p style={{ color: "var(--zl-text-dim)" }}>
            Task board connects to the indexer once contracts are deployed.
            Tasks stream here in real time over WebSocket.
          </p>
        </div>
      </section>
    </div>
  );
}
