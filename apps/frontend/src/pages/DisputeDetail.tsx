import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface Dispute {
  taskId: string;
  quorum: string;
  clientVotes: string;
  freelancerVotes: string;
  abstainVotes: string;
  arbiterCount: string;
  resolved: boolean;
  winner?: string;
  createdAt: string;
}

export default function DisputeDetail() {
  const { taskId } = useParams();
  const config = useConfig();
  const { address, connected } = useAuth();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<string>("");

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<Dispute>(`/v1/disputes/${taskId}`),
      api<{ events: any[] }>(`/v1/events?eventName=VoteCast&limit=50`),
    ])
      .then(([dispRes, eventsRes]) => {
        if (!cancelled) {
          setDispute(dispRes);
          setEvents(eventsRes.events?.filter((e) => e.payload.taskId === taskId) ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleVote = async () => {
    if (!taskId || !voteChoice) return;
    try {
      await api(`/v1/disputes/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, choice: voteChoice }),
      });
      window.location.reload();
    } catch (e: any) {
      alert(e.message ?? "Vote failed");
    }
  };

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;
  if (!dispute) return <div className="zl-container" style={{ padding: "40px 32px" }}><p>Dispute not found.</p></div>;

  const isArbiter = connected && address && events.some((e) => e.payload.arbiter?.toLowerCase() === address.toLowerCase());

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to="/disputes" style={{ color: "var(--color-graphite)" }}>← Disputes</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Dispute — Task #{dispute.taskId}</h1>
          <Pill variant={dispute.resolved ? "success" : "warning"}>{dispute.resolved ? "Resolved" : "Open"}</Pill>
        </div>

        <div className="zl-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Quorum</span>
              <span>{dispute.quorum}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Client Votes</span>
              <span>{dispute.clientVotes}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Freelancer Votes</span>
              <span>{dispute.freelancerVotes}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Abstain Votes</span>
              <span>{dispute.abstainVotes}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Winner</span>
              <span>{dispute.winner || "—"}</span>
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: "var(--text-subheading)", margin: "0 0 16px" }}>Timeline</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.length === 0 ? (
            <div className="zl-card"><Empty title="No events" description="Dispute events will appear here." /></div>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="zl-card" style={{ padding: "16px 40px" }}>
                <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                  <strong>{ev.eventName}</strong> — {new Date(ev.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {!dispute.resolved && isArbiter && (
          <div className="zl-card" style={{ marginTop: 24 }}>
            <h3 style={{ margin: "0 0 16px" }}>Cast Vote</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <select className="zl-select" value={voteChoice} onChange={(e) => setVoteChoice(e.target.value)} style={{ maxWidth: 200 }}>
                <option value="">Select vote...</option>
                <option value="Client">Client</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Abstain">Abstain</option>
              </select>
              <Button onClick={handleVote} disabled={!voteChoice}>Submit Vote</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
