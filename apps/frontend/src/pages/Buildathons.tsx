import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface BuildathonEvent {
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

export default function Buildathons() {
  const config = useConfig();
  const [events, setEvents] = useState<BuildathonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ events: BuildathonEvent[] }>("/v1/events?eventName=ProgramCreated&limit=50")
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

  if (!config.addresses.waveBuildathon) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Buildathons not configured" description="Wave buildathon contracts are not deployed on this network." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Buildathons</h1>
          <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Team-based buildathon programs.</p>
        </div>
        <div style={{ marginLeft: "auto" }}><Link to="/buildathons/new"><Button>Create Buildathon</Button></Link></div>
      </div>
      {events.length === 0 ? (
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <Empty title="No buildathons yet" description="Create a buildathon program to get started." />
        </div>
      ) : (
        <div className="zl-container">
          <div className="zl-grid zl-grid--2" style={{ marginTop: 40 }}>
            {events.map((ev) => (
              <Link key={ev.id} to={`/buildathons/${ev.payload.programId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pill variant="accent">Buildathon #{ev.payload.programId}</Pill>
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
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
