import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

type Tab = "overview" | "teams" | "submissions" | "waves";

export interface ProgramMeta {
  programId: string;
  token: string;
  organizer: string;
  treasury: string;
  feeBps: string;
  initialized: boolean;
}

export default function BuildathonDetail() {
  const { programId } = useParams();
  const config = useConfig();
  const [tab, setTab] = useState<Tab>("overview");
  const [meta, setMeta] = useState<ProgramMeta | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildathonAddress = config.addresses.waveBuildathon;

  useEffect(() => {
    if (!programId || !buildathonAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ program: ProgramMeta }>(`/v1/wave/program/${programId}`)
      .then((res) => {
        if (!cancelled) setMeta(res.program);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [programId, buildathonAddress]);

  useEffect(() => {
    if (!programId || tab !== "submissions") return;
    let cancelled = false;
    api<{ submission: any }>(`/v1/wave/buildathon/submission/${programId}`)
      .then((res) => {
        if (!cancelled) setSubmissions([res.submission].filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      });
    return () => { cancelled = true; };
  }, [programId, tab]);

  if (!buildathonAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Buildathons not configured" description="Wave buildathon contracts are not deployed on this network." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;
  if (!meta) return <div className="zl-container" style={{ padding: "40px 32px" }}><p>Buildathon not found.</p></div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "teams", label: "Teams" },
    { key: "submissions", label: "Submissions" },
    { key: "waves", label: "Waves" },
  ];

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to="/buildathons" style={{ color: "var(--color-graphite)" }}>← Buildathons</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Buildathon #{meta.programId}</h1>
        </div>

        <div className="zl-tabs" style={{ marginBottom: 32 }}>
          {tabs.map((t) => (
            <button key={t.key} className={`zl-tab${tab === t.key ? " zl-tab--active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="zl-card">
            <div className="zl-grid zl-grid--2">
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Organizer</span><div style={{ marginTop: 4 }}><Address value={meta.organizer} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Token</span><div style={{ marginTop: 4 }}><Address value={meta.token} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Treasury</span><div style={{ marginTop: 4 }}><Address value={meta.treasury} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Fee (bps)</span><div style={{ marginTop: 4 }}>{meta.feeBps}</div></div>
            </div>
          </div>
        )}

        {tab === "teams" && (
          <div className="zl-card">
            <Empty title="Teams" description="Team registrations will appear here during open waves." />
          </div>
        )}

        {tab === "submissions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {submissions.length === 0 ? (
              <div className="zl-card"><Empty title="No submissions" description="Submissions will appear here once made." /></div>
            ) : (
              submissions.map((s, i) => (
                <div key={i} className="zl-card">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Submission</span>
                      <span>#{s.subId ?? i}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Points</span>
                      <span>{s.points ?? "0"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "waves" && (
          <div className="zl-card">
            <Empty title="Waves" description="Wave details will appear here." />
          </div>
        )}
      </div>
    </div>
  );
}
