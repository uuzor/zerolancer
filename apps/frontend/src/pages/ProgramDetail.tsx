import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

type Tab = "overview" | "waves" | "projects" | "builders" | "awarders" | "pool";

export interface ProgramMeta {
  programId: string;
  token: string;
  organizer: string;
  treasury: string;
  feeBps: string;
  initialized: boolean;
  remainingPool?: string;
  waveBudget?: string;
  totalPoints?: string;
}

export interface WaveInfo {
  programId: string;
  status: string;
  buildEndAt: string;
  evalEndAt: string;
  complimentEndAt: string;
  budget: string;
  totalDistributed: string;
  finalized: boolean;
}

export interface ProjectInfo {
  id: string;
  programId: string;
  waveId: string;
  builder: string;
  team: string;
  repoUrl: string;
  repoHash: string;
  contentHash: string;
  description: string;
  status: string;
  pointsAwarded: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderInfo {
  address: string;
  programId: string;
  name: string;
  bio: string;
  repoUrl: string;
  appliedAt: string;
}

export default function ProgramDetail() {
  const { programId } = useParams();
  const config = useConfig();
  const { authApi } = useAuthenticatedApi();
  const [tab, setTab] = useState<Tab>("overview");
  const [meta, setMeta] = useState<ProgramMeta | null>(null);
  const [waves, setWaves] = useState<WaveInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [builders, setBuilders] = useState<BuilderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const programAddress = config.addresses.waveProgram;

  useEffect(() => {
    if (!programId || !programAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ program: ProgramMeta }>(`/v1/wave/program/${programId}`),
      api<{ remainingPool: string; waveBudget: string; totalPoints: string }>(`/v1/wave/program/${programId}/meta`),
      api<{ builders: BuilderInfo[] }>(`/v1/wave/program/${programId}/builders`),
      api<{ projects: ProjectInfo[] }>(`/v1/wave/program/${programId}/projects`),
    ])
      .then(([progRes, metaRes, buildersRes, projectsRes]) => {
        if (cancelled) return;
        setMeta({ ...progRes.program, ...metaRes } as ProgramMeta);
        setBuilders(buildersRes.builders ?? []);
        setProjects(projectsRes.projects ?? []);
        const current = Number((progRes.program as any).currentWave ?? 0);
        const wavePromises: Promise<WaveInfo>[] = [];
        for (let i = 0; i <= current; i++) {
          wavePromises.push(
            api<WaveInfo>(`/v1/wave/program/${programId}/wave/${i}`).catch(() => ({
              programId,
              status: "Unknown",
              buildEndAt: "0",
              evalEndAt: "0",
              complimentEndAt: "0",
              budget: "0",
              totalDistributed: "0",
              finalized: false,
            }))
          );
        }
        return Promise.all(wavePromises).then((ws) => {
          if (!cancelled) setWaves(ws);
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [programId, programAddress]);

  const handleDeposit = async () => {
    if (!programId || !depositAmount) return;
    setDepositing(true);
    try {
      await api(`/v1/wave/program/${programId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: depositAmount }),
      });
      setDepositAmount("");
      window.location.reload();
    } catch (e: any) {
      alert(e.message ?? "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleWaveAction = async (action: string, waveId: number, body?: Record<string, any>) => {
    if (!programId) return;
    setActionLoading(`${action}-${waveId}`);
    setActionError(null);
    try {
      await authApi(`/v1/wave/program/${programId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveId, ...body }),
      });
      window.location.reload();
    } catch (e: any) {
      setActionError(e.message ?? `${action} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!programAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Wave funding not deployed" description="Configure wave contract addresses to view programs." />
      </div>
    );
  }

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;
  if (!meta) return <div className="zl-container" style={{ padding: "40px 32px" }}><p>Program not found.</p></div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "waves", label: "Waves" },
    { key: "projects", label: "Projects" },
    { key: "builders", label: "Builders" },
    { key: "awarders", label: "Awarders" },
    { key: "pool", label: "Pool" },
  ];

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to="/programs" style={{ color: "var(--color-graphite)" }}>← Programs</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Program #{meta.programId}</h1>
        </div>

        <div className="zl-tabs" style={{ marginBottom: 32 }}>
          {tabs.map((t) => (
            <button key={t.key} className={`zl-tab${tab === t.key ? " zl-tab--active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {actionError && <div className="zl-card" style={{ marginBottom: 24, borderColor: "#f5d5d5", background: "#fff5f5" }}><p style={{ color: "#5c2a2a", margin: 0 }}>{actionError}</p></div>}

        {tab === "overview" && (
          <div className="zl-card">
            <div className="zl-grid zl-grid--2">
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Organizer</span><div style={{ marginTop: 4 }}><Address value={meta.organizer} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Token</span><div style={{ marginTop: 4 }}><Address value={meta.token} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Treasury</span><div style={{ marginTop: 4 }}><Address value={meta.treasury} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Fee (bps)</span><div style={{ marginTop: 4 }}>{meta.feeBps}</div></div>
              {meta.remainingPool !== undefined && (
                <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Remaining Pool</span><div style={{ marginTop: 4 }}><Money value={meta.remainingPool} token="USDC" /></div></div>
              )}
              {meta.waveBudget !== undefined && (
                <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Wave Budget</span><div style={{ marginTop: 4 }}><Money value={meta.waveBudget} token="USDC" /></div></div>
              )}
              {meta.totalPoints !== undefined && (
                <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Total Points</span><div style={{ marginTop: 4 }}>{meta.totalPoints}</div></div>
              )}
            </div>
          </div>
        )}

        {tab === "waves" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {waves.length === 0 ? (
              <Empty title="No waves yet" description="Waves will appear here once opened." />
            ) : (
              waves.map((w, i) => (
                <div key={i} className="zl-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ flex: "1 1 240px" }}>
                    <div style={{ fontWeight: 600 }}>Wave #{i}</div>
                    <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                      Budget: <Money value={w.budget} token="USDC" /> · Distributed: <Money value={w.totalDistributed} token="USDC" />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-graphite)", marginTop: 4 }}>
                      {Number(w.buildEndAt) > 0 && <Countdown to={Number(w.buildEndAt) * 1000} label="Build ends" />}
                      {Number(w.evalEndAt) > 0 && <span> · </span>}
                      {Number(w.evalEndAt) > 0 && <Countdown to={Number(w.evalEndAt) * 1000} label="Eval ends" />}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <Pill variant={w.status === "Open" ? "success" : w.status === "Evaluation" ? "warning" : "default"}>{w.status}</Pill>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Button size="sm" variant="ghost" disabled={!!actionLoading} onClick={() => handleWaveAction("open-wave", i)}>Open Wave</Button>
                      <Button size="sm" variant="ghost" disabled={!!actionLoading} onClick={() => handleWaveAction("close-wave", i)}>Close Wave</Button>
                      <Button size="sm" variant="ghost" disabled={!!actionLoading} onClick={() => handleWaveAction("open-evaluation", i)}>Open Eval</Button>
                      <Button size="sm" variant="ghost" disabled={!!actionLoading} onClick={() => handleWaveAction("close-evaluation", i)}>Close Eval</Button>
                      <Button size="sm" variant="ghost" disabled={!!actionLoading} onClick={() => handleWaveAction("finalize", i)}>Finalize</Button>
                      {!(w as any).finalized && i === 0 && (
                        <Button size="sm" disabled={!!actionLoading} onClick={() => handleWaveAction("claim", i)}>Claim</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "projects" && (
          <div className="zl-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Projects</h3>
              <Link to={`/programs/${programId}/projects`}><Button size="sm">View All Projects</Button></Link>
            </div>
            {projects.length === 0 ? (
              <Empty title="No projects yet" description="Projects will appear here once builders submit." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {projects.slice(0, 10).map((p) => (
                  <div key={p.id} className="zl-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ flex: "1 1 240px" }}>
                      <div style={{ fontWeight: 600 }}>Wave #{p.waveId} · {p.status}</div>
                      <div style={{ fontSize: 13, color: "var(--color-graphite)", marginTop: 4 }}>
                        <Address value={p.builder} /> · {p.team ? `Team: ${p.team}` : "Solo"}
                      </div>
                      {p.description ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-graphite)" }}>{p.description}</p> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <a href={p.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Repo ↗</a>
                      <Link to={`/project/${p.id}`}><Button size="sm">View</Button></Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "builders" && (
          <div className="zl-card">
            <h3 style={{ marginTop: 0 }}>Builders</h3>
            {builders.length === 0 ? (
              <Empty title="No builders yet" description="Builders will appear here once they register." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {builders.map((b) => (
                  <div key={`${b.address}-${b.programId}`} className="zl-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.name || "Anonymous Builder"}</div>
                      <div style={{ fontSize: 13, color: "var(--color-graphite)", marginTop: 4 }}>
                        <Address value={b.address} />
                      </div>
                      {b.bio ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-graphite)" }}>{b.bio}</p> : null}
                    </div>
                    {b.repoUrl ? <a href={b.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Repo ↗</a> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "awarders" && (
          <div className="zl-card">
            <Empty title="Awarders" description="Awarder management is available on-chain." />
          </div>
        )}

        {tab === "pool" && (
          <div className="zl-card">
            <h3 style={{ marginTop: 0 }}>Top Up Pool</h3>
            <p style={{ color: "var(--color-graphite)", fontSize: 14 }}>Deposit additional USDC into the program pool.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                className="zl-input"
                type="text"
                placeholder="Amount (USDC, 6 decimals)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              <Button onClick={handleDeposit} disabled={depositing || !depositAmount}>
                {depositing ? "Depositing..." : "Top Up"}
              </Button>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-graphite)", marginTop: 8 }}>This action is signer-gated and requires backend approval.</p>
          </div>
        )}
      </div>
    </div>
  );
}
