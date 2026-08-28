import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface IssueCreatedEvent {
  id: string;
  eventName: string;
  payload: {
    issueId: string;
    programId: string;
    maintainer: string;
    basePoints: string;
    repoHash?: string;
  };
}

export default function Issues() {
  const config = useConfig();
  const [events, setEvents] = useState<IssueCreatedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ events: IssueCreatedEvent[] }>("/v1/events?eventName=IssueCreated&limit=50")
      .then((res) => {
        if (!cancelled) setEvents(res.events ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (!config.addresses.waveIssue) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Issues not configured" description="Wave issue contracts are not deployed on this network." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Issues</h1>
          <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Wave-funded GitHub issues.</p>
        </div>
        <div style={{ marginLeft: "auto" }}><Link to="/issues/new"><Button>Create Issue</Button></Link></div>
      </div>
      {events.length === 0 ? (
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <Empty title="No issues yet" description="Create a wave issue to start distributing rewards." action={<Link to="/issues/new"><Button>Create Issue</Button></Link>} />
        </div>
      ) : (
        <div className="zl-container">
          <div className="zl-grid zl-grid--2" style={{ marginTop: 40 }}>
            {events.map((ev) => (
              <Link key={ev.id} to={`/issues/${ev.payload.issueId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pill variant="accent">Issue #{ev.payload.issueId}</Pill>
                  <Pill variant="default">Created</Pill>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Program</span>
                    <span>#{ev.payload.programId}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Maintainer</span>
                    <Address value={ev.payload.maintainer} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Base Points</span>
                    <span>{ev.payload.basePoints}</span>
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
