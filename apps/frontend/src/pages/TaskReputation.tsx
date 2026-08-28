import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Empty, ErrorPane } from "../components/Alden.js";

type ReputationEvent = { eventName: string; payload: Record<string, any>; createdAt: string };

export default function TaskReputation() {
  const { taskId } = useParams<{ taskId: string }>();
  const { connected } = useAuth();
  const [events, setEvents] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staked, setStaked] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const loadEvents = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ events: ReputationEvent[] }>(`/v1/events/${taskId}?eventName=ReputationMinted`);
      setEvents(res.events ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const mintedEvent = events[0];

  const handleStake = async () => {
    if (!taskId || !mintedEvent) return;
    setError(null);
    try {
      const tokenId = mintedEvent.payload.tokenId ?? taskId;
      const res = await api<{ calldata: string; to: string }>("/v1/reputation/stake", {
        method: "POST",
        body: JSON.stringify({ tokenId }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      setStaked(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Reputation</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        {loading && <p>Loading…</p>}
        {error && <ErrorPane message={error} retry={loadEvents} />}

        {!loading && !error && (
          <>
            {mintedEvent ? (
              <div>
                <Pill variant="success">Minted</Pill>

                <div style={{ marginTop: 16 }}>
                  <span className="zl-label">Token ID</span>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{mintedEvent.payload.tokenId ?? "—"}</p>
                </div>

                <div style={{ marginTop: 12 }}>
                  <span className="zl-label">Data Description</span>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{mintedEvent.payload.dataDescription ?? "—"}</p>
                </div>

                <div style={{ marginTop: 12 }}>
                  <span className="zl-label">Data Hash</span>
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {mintedEvent.payload.dataHash ?? "—"}
                  </p>
                </div>

                {connected && !staked && (
                  <div style={{ marginTop: 16 }}>
                    <Button onClick={handleStake}>Stake Verified Badge</Button>
                  </div>
                )}

                {staked && (
                  <div style={{ marginTop: 16 }}>
                    <Pill variant="success">Badge Staked</Pill>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <a href="/reputation" style={{ textDecoration: "none" }}><Button variant="ghost">View Reputation Page</Button></a>
                </div>
              </div>
            ) : (
              <Empty
                title="Will mint on pass"
                description="A reputation NFT will be minted once this task passes verification."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
