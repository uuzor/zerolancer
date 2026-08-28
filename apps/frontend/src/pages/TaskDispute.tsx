import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useSendTransaction } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Empty, ErrorPane } from "../components/Alden.js";

type DisputeEvent = { eventName: string; payload: Record<string, any>; createdAt: string };
type DisputeState = { taskId: string; events: DisputeEvent[] };

const ARBITER_CHOICES = ["Client", "Freelancer", "Abstain"] as const;

export default function TaskDispute() {
  const { taskId } = useParams<{ taskId: string }>();
  const { address, connected } = useAuth();
  const [dispute, setDispute] = useState<DisputeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [voting, setVoting] = useState(false);

  const { sendTransaction } = useSendTransaction();

  const loadDispute = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<DisputeState>(`/v1/disputes/${taskId}`);
      setDispute(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadDispute();
  }, [loadDispute]);

  const openedEvent = dispute?.events.find((e) => e.eventName === "DisputeOpened");
  const resolvedEvent = dispute?.events.find((e) => e.eventName === "DisputeResolved");
  const hasVoted = dispute?.events.some((e) => e.eventName === "VoteCast" && e.payload.arbiter === address);

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const openedAt = openedEvent ? Number(openedEvent.createdAt) * 1000 : 0;
  const canEscalate = openedEvent && !resolvedEvent && Date.now() - openedAt >= fourteenDaysMs;

  const handleEscalate = async () => {
    if (!taskId) return;
    setEscalating(true);
    setError(null);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/disputes/escalate", {
        method: "POST",
        body: JSON.stringify({ taskId, arbiters: [address] }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      await loadDispute();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEscalating(false);
    }
  };

  const handleVote = async (choice: string) => {
    if (!taskId) return;
    setVoting(true);
    setError(null);
    try {
      const res = await api<{ calldata: string; to: string }>("/v1/disputes/vote", {
        method: "POST",
        body: JSON.stringify({ taskId, choice }),
      });
      await sendTransaction({ to: res.to as `0x${string}`, data: res.calldata as `0x${string}` });
      await loadDispute();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVoting(false);
    }
  };

  if (!taskId) return <ErrorPane message="Missing task id" />;

  return (
    <div className="zl-container" style={{ padding: "40px 32px" }}>
      <h1 style={{ fontSize: "var(--text-heading-sm)", margin: "0 0 24px" }}>Dispute</h1>

      <div className="zl-card" style={{ maxWidth: 640 }}>
        {loading && <p>Loading dispute…</p>}
        {error && <ErrorPane message={error} retry={loadDispute} />}

        {!loading && !error && (
          <>
            {resolvedEvent ? (
              <div>
                <Pill variant={resolvedEvent.payload.winner === address ? "success" : "danger"}>
                  Resolved — {resolvedEvent.payload.winner} wins
                </Pill>
                <p style={{ color: "var(--color-graphite)", marginTop: 12 }}>
                  This dispute has been resolved.
                </p>
              </div>
            ) : openedEvent ? (
              <div>
                <Pill variant="danger">Dispute Open</Pill>
                <p style={{ color: "var(--color-graphite)", marginTop: 12 }}>
                  Opened {new Date(openedAt).toLocaleString()}.
                </p>

                {!canEscalate && (
                  <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>
                    Retry window open. Builder can resubmit. Escalation available after 14 days.
                  </p>
                )}

                {canEscalate && (
                  <div style={{ marginTop: 16 }}>
                    {!connected ? (
                      <p style={{ color: "var(--color-graphite)" }}>Connect wallet to escalate.</p>
                    ) : (
                      <Button onClick={handleEscalate} disabled={escalating}>
                        {escalating ? "Escalating…" : "Escalate to Arbiters"}
                      </Button>
                    )}
                  </div>
                )}

                {openedEvent && (
                  <div style={{ marginTop: 24 }}>
                    <span className="zl-label">Arbiters</span>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(openedEvent.payload.arbiters ?? []).map((a: string) => (
                        <Address key={a} value={a} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Empty
                title="No dispute"
                description="There is no open dispute for this task."
              />
            )}

            {openedEvent && !resolvedEvent && !hasVoted && connected && (
              <div style={{ marginTop: 24 }}>
                <span className="zl-label">Cast your vote</span>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {ARBITER_CHOICES.map((choice) => (
                    <Button key={choice} variant="ghost" size="sm" onClick={() => handleVote(choice)} disabled={voting}>
                      {choice}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {hasVoted && (
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--color-graphite)" }}>You have already voted.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
