import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Countdown, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

type Tab = "overview" | "waves" | "awarders" | "pool";

export interface ProgramMeta {
  programId: string;
  token: string;
  organizer: string;
  genesisPool: string;
  numWaves: string;
  buildWindow: string;
  evalWindow: string;
  complimentWindow: string;
  budgetMethod: string;
  feeBps: string;
  treasury: string;
  currentWave: string;
  waveSeq: string;
  initialized: boolean;
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

export default function ProgramDetail() {
  const { programId } = useParams();
  const config = useConfig();
  const [tab, setTab] = useState<Tab>("overview");
  const [meta, setMeta] = useState<ProgramMeta | null>(null);
  const [waves, setWaves] = useState<WaveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const programAddress = config.addresses.waveProgram;

  useEffect(() => {
    if (!programId || !programAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ program: ProgramMeta }>(`/v1/wave/program/${programId}`),
      api<{ remainingPool: string; waveBudget: string; totalPoints: string }>(`/v1/wave/program/${programId}/meta`),
    ])
      .then(([progRes, metaRes]) => {
        if (cancelled) return;
        setMeta({ ...progRes.program, ...metaRes } as ProgramMeta);
        const current = Number(progRes.program.currentWave ?? 0);
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

        {tab === "overview" && (
          <div className="zl-card">
            <div className="zl-grid zl-grid--2">
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Organizer</span><div style={{ marginTop: 4 }}><Address value={meta.organizer} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Token</span><div style={{ marginTop: 4 }}><Address value={meta.token} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Treasury</span><div style={{ marginTop: 4 }}><Address value={meta.treasury} /></div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Budget Method</span><div style={{ marginTop: 4 }}>{meta.budgetMethod}</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Fee (bps)</span><div style={{ marginTop: 4 }}>{meta.feeBps}</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Num Waves</span><div style={{ marginTop: 4 }}>{meta.numWaves}</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Build Window</span><div style={{ marginTop: 4 }}>{meta.buildWindow}s</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Eval Window</span><div style={{ marginTop: 4 }}>{meta.evalWindow}s</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Compliment Window</span><div style={{ marginTop: 4 }}>{meta.complimentWindow}s</div></div>
              <div><span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Current Wave</span><div style={{ marginTop: 4 }}>#{meta.currentWave}</div></div>
            </div>
          </div>
        )}

        {tab === "waves" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {waves.length === 0 ? (
              <Empty title="No waves yet" description="Waves will appear here once opened." />
            ) : (
              waves.map((w, i) => (
                <div key={i} className="zl-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Wave #{i}</div>
                    <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>
                      Budget: <Money value={w.budget} token="USDC" /> · Distributed: <Money value={w.totalDistributed} token="USDC" />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Pill variant={w.status === "Open" ? "success" : w.status === "Evaluation" ? "warning" : "default"}>{w.status}</Pill>
                    <div style={{ fontSize: 12, color: "var(--color-graphite)", marginTop: 4 }}>
                      {Number(w.buildEndAt) > 0 && <Countdown to={Number(w.buildEndAt) * 1000} label="Build ends" />}
                    </div>
                  </div>
                </div>
              ))
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
