import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface DisputeEvent {
  id: string;
  eventName: string;
  payload: {
    taskId: string;
    quorum: string;
    clientVotes: string;
    freelancerVotes: string;
    abstainVotes: string;
    arbiterCount: string;
    resolved: boolean;
    winner?: string;
    createdAt: string;
  };
}

export default function Disputes() {
  const [open, setOpen] = useState<DisputeEvent[]>([]);
  const [resolved, setResolved] = useState<DisputeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ events: DisputeEvent[] }>("/v1/events?eventName=DisputeOpened&limit=50"),
      api<{ events: DisputeEvent[] }>("/v1/events?eventName=DisputeResolved&limit=50"),
    ])
      .then(([opened, closed]) => {
        if (!cancelled) {
          setOpen(opened.events ?? []);
          setResolved(closed.events ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Disputes</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Open and resolved disputes.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40 }}>
          <div>
            <h2 style={{ fontSize: "var(--text-subheading)", margin: "0 0 16px" }}>Open</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {open.length === 0 ? (
                <div className="zl-card"><Empty title="No open disputes" /></div>
              ) : (
                open.map((d) => (
                  <Link key={d.id} to={`/disputes/${d.payload.taskId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Task #{d.payload.taskId}</span>
                      <Pill variant="warning">Open</Pill>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                      Votes: {d.payload.clientVotes}C / {d.payload.freelancerVotes}F / {d.payload.abstainVotes}A
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: "var(--text-subheading)", margin: "0 0 16px" }}>Resolved</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {resolved.length === 0 ? (
                <div className="zl-card"><Empty title="No resolved disputes" /></div>
              ) : (
                resolved.map((d) => (
                  <Link key={d.id} to={`/disputes/${d.payload.taskId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Task #{d.payload.taskId}</span>
                      <Pill variant="success">Resolved</Pill>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                      Winner: {d.payload.winner || "—"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
