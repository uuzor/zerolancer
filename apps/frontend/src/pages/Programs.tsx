import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface ProgramSummary {
  programId: string;
  organizer: string;
  token: string;
  treasury: string;
  feeBps: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export default function Programs() {
  const { connected } = useAuth();
  const config = useConfig();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ programs: ProgramSummary[] }>("/v1/wave/programs")
      .then((res) => {
        if (!cancelled) setPrograms(res.programs ?? []);
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
      {programs.length === 0 ? (
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
            {programs.map((prog) => (
              <Link key={prog.programId} to={`/programs/${prog.programId}`} className="zl-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Pill variant="accent">Program #{prog.programId}</Pill>
                  <Pill variant="success">Active</Pill>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {prog.description ? (
                    <p style={{ margin: 0, fontSize: 14, color: "var(--color-graphite)", lineHeight: 1.5 }}>{prog.description}</p>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Organizer</span>
                    <Address value={prog.organizer} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Fee</span>
                    <span>{prog.feeBps} bps</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Updated</span>
                    <span>{new Date(prog.updatedAt).toLocaleDateString()}</span>
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
