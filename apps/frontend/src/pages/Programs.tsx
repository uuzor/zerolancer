import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface ProgramCreatedEvent {
  id: string;
  eventName: string;
  payload: {
    programId: string;
    organizer: string;
    token?: string;
    genesisPool?: string;
    numWaves?: string;
    currentWave?: string;
  };
}

export default function Programs() {
  const { connected } = useAuth();
  const config = useConfig();
  const [events, setEvents] = useState<ProgramCreatedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ events: ProgramCreatedEvent[] }>("/v1/events?eventName=ProgramCreated&limit=50")
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

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Programs</h1>
          <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Wave funding programs distributing rewards across waves.</p>
        </div>
        {connected ? (
          <Link to="/programs/new"><Button>Create Program</Button></Link>
        ) : null}
      </div>
      {events.length === 0 ? (
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <Empty
            title="No programs yet"
            description="Create a wave program to start distributing rewards."
            action={connected ? <Link to="/programs/new"><Button>Create Program</Button></Link> : undefined}
          />
        </div>
      ) : (
        <div className="zl-container">
          <div className="zl-grid zl-grid--2" style={{ marginTop: 40 }}>
            {events.map((ev) => (
              <Link key={ev.id} to={`/programs/${ev.payload.programId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pill variant="accent">Program #{ev.payload.programId}</Pill>
                  <Pill variant="success">Active</Pill>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Organizer</span>
                    <Address value={ev.payload.organizer} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Pool</span>
                    <Money value={ev.payload.genesisPool ?? "0"} token="USDC" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Waves</span>
                    <span>{ev.payload.numWaves ?? "0"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Current Wave</span>
                    <span>#{ev.payload.currentWave ?? "0"}</span>
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
