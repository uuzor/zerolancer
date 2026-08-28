import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { ZEROLANCE_REPUTATION_NFT_ABI } from "../abis.js";
import { useReadContract } from "wagmi";
import { Button, Pill, Address, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface ReputationMintedEvent {
  id: string;
  eventName: string;
  payload: {
    tokenId: string;
    freelancer: string;
    taskId: string;
  };
}

export default function Reputation() {
  const { address: routeAddress } = useParams();
  const { address: walletAddress, connected } = useAuth();
  const config = useConfig();
  const displayAddress = routeAddress || walletAddress || "";
  const [events, setEvents] = useState<ReputationMintedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: isVerified } = useReadContract({
    address: config.addresses.reputationNft as `0x${string}` | undefined,
    abi: ZEROLANCE_REPUTATION_NFT_ABI,
    functionName: "isVerified",
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    query: { enabled: !!config.addresses.reputationNft && !!displayAddress },
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ events: ReputationMintedEvent[] }>(`/v1/events?eventName=ReputationMinted&limit=50`)
      .then((res) => {
        if (!cancelled) {
          const filtered = displayAddress
            ? res.events?.filter((e) => e.payload.freelancer.toLowerCase() === displayAddress.toLowerCase())
            : res.events;
          setEvents(filtered ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [displayAddress]);

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Reputation</h1>
          <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>
            {displayAddress ? <Address value={displayAddress} /> : "Connect wallet to view reputation"}
          </p>
        </div>
        {isVerified && <Pill variant="success">Verified</Pill>}
      </div>
      {events.length === 0 ? (
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <Empty title="No reputation NFTs" description="Complete tasks to mint reputation NFTs." />
        </div>
      ) : (
        <div className="zl-container">
          <div className="zl-grid zl-grid--2" style={{ marginTop: 40 }}>
            {events.map((ev) => (
              <Link key={ev.id} to={`/reputation/${ev.payload.freelancer}/nft/${ev.payload.tokenId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pill variant="accent">NFT #{ev.payload.tokenId}</Pill>
                  <Pill variant="success">Minted</Pill>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Task</span>
                    <span>#{ev.payload.taskId}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Owner</span>
                    <Address value={ev.payload.freelancer} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
