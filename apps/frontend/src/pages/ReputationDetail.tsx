import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { ZEROLANCE_REPUTATION_NFT_ABI } from "@zerolance/config/abis";
import { useReadContract, useWriteContract } from "wagmi";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export default function ReputationDetail() {
  const { address, tokenId, stake } = useParams();
  const config = useConfig();
  const { address: walletAddress, connected } = useAuth();
  const [nft, setNft] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeReadyAt, setUnstakeReadyAt] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStakePage = stake === "stake";
  const displayAddress = address || walletAddress || "";
  const nftAddress = config.addresses.reputationNft;

  const { data: owner } = useReadContract({
    address: nftAddress as `0x${string}` | undefined,
    abi: ZEROLANCE_REPUTATION_NFT_ABI,
    functionName: "ownerOf",
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: { enabled: !!nftAddress && !!tokenId && !isStakePage },
  });

  const { data: stakeOf } = useReadContract({
    address: nftAddress as `0x${string}` | undefined,
    abi: ZEROLANCE_REPUTATION_NFT_ABI,
    functionName: "stakeOf",
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    query: { enabled: !!nftAddress && !!displayAddress && isStakePage },
  });

  const { data: isVerified } = useReadContract({
    address: nftAddress as `0x${string}` | undefined,
    abi: ZEROLANCE_REPUTATION_NFT_ABI,
    functionName: "isVerified",
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    query: { enabled: !!nftAddress && !!displayAddress && isStakePage },
  });

  const { writeContract } = useWriteContract();

  useEffect(() => {
    if (!tokenId || isStakePage) return;
    let cancelled = false;
    setLoading(true);
    api<any>(`/v1/events?eventName=ReputationMinted&limit=50`)
      .then((res) => {
        if (!cancelled) {
          const found = res.events?.find((e: any) => e.payload.tokenId === tokenId);
          setNft(found || null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tokenId, isStakePage]);

  const handleStake = () => {
    if (!nftAddress || !stakeAmount) return;
    setActing(true);
    writeContract({
      address: nftAddress as `0x${string}`,
      abi: ZEROLANCE_REPUTATION_NFT_ABI,
      functionName: "stakeVerifiedBadge",
      args: [BigInt(stakeAmount)],
    });
    setActing(false);
  };

  const handleUnstake = () => {
    if (!nftAddress || !stakeAmount) return;
    setActing(true);
    writeContract({
      address: nftAddress as `0x${string}`,
      abi: ZEROLANCE_REPUTATION_NFT_ABI,
      functionName: "unstakeVerifiedBadge",
      args: [BigInt(stakeAmount)],
    });
    setActing(false);
  };

  if (!nftAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Reputation not configured" description="Reputation NFT contracts are not deployed on this network." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  if (isStakePage) {
    return (
      <div className="zl-section">
        <div className="zl-container">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Link to={`/reputation/${displayAddress}`} style={{ color: "var(--color-graphite)" }}>← Reputation</Link>
            <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Stake</h1>
            {isVerified && <Pill variant="success">Verified</Pill>}
          </div>
          <div className="zl-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Current Stake</span>
                <span>{stakeOf ? Number(stakeOf) / 1e18 : 0} ZERO</span>
              </div>
              <div>
                <label className="zl-label">Amount (ZERO, 18 decimals)</label>
                <input className="zl-input" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="1000000000000000000" />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Button onClick={handleStake} disabled={acting || !connected || !stakeAmount}>
                  {acting ? "Signing..." : "Stake"}
                </Button>
                <Button variant="ghost" onClick={handleUnstake} disabled={acting || !connected || !stakeAmount}>
                  {acting ? "Signing..." : "Unstake"}
                </Button>
              </div>
              {unstakeReadyAt && (
                <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                  Unstake ready in <Countdown to={Number(unstakeReadyAt) * 1000} label="timelock" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to={`/reputation/${displayAddress}`} style={{ color: "var(--color-graphite)" }}>← Reputation</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>NFT #{tokenId}</h1>
        </div>
        {nft ? (
          <div className="zl-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Owner</span>
                <Address value={owner as string || nft.payload.freelancer} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Task</span>
                <span>#{nft.payload.taskId}</span>
              </div>
              <div style={{ marginTop: 16 }}><Link to={`/reputation/${displayAddress}/stake`}><Button>Manage Stake</Button></Link></div>
            </div>
          </div>
        ) : (
          <Empty title="NFT not found" description="This reputation NFT could not be loaded." />
        )}
      </div>
    </div>
  );
}
