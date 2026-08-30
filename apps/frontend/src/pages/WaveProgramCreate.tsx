import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi.js";
import { Button, Pill, Empty } from "../components/Alden.js";

export default function WaveProgramCreate() {
  const navigate = useNavigate();
  const config = useConfig();
  const { connected } = useAuth();
  const { authApi } = useAuthenticatedApi();
  const programAddress = config.addresses.waveProgram;

  const [token, setToken] = useState(config.addresses.mockUsdc ?? "");
  const [genesisPool, setGenesisPool] = useState("");
  const [feeBps, setFeeBps] = useState("250");
  const [treasury, setTreasury] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!programAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Wave funding not deployed" description="Configure wave contract addresses to create programs." />
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi<{ txHash: string; programId?: string }>("/v1/wave/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          genesisPool,
          feeBps: Number(feeBps),
          treasury,
          description,
        }),
      });
      const programId = res.programId;
      if (programId) {
        navigate(`/programs/${programId}`);
      } else {
        navigate("/programs");
      }
    } catch (e: any) {
      setError(e.message ?? "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Create Program</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Deploy a new wave program to distribute rewards.</p>

        {error && <div className="zl-card" style={{ marginTop: 24, borderColor: "#f5d5d5", background: "#fff5f5" }}><p style={{ color: "#5c2a2a", margin: 0 }}>{error}</p></div>}

        <div className="zl-card" style={{ marginTop: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
            <div>
              <label className="zl-label">Token Address</label>
              <input className="zl-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="0x..." />
            </div>
            <div>
              <label className="zl-label">Genesis Pool (USDC, 6 decimals)</label>
              <input className="zl-input" type="number" value={genesisPool} onChange={(e) => setGenesisPool(e.target.value)} placeholder="10000000000" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="zl-label">Fee (bps)</label>
                <input className="zl-input" type="number" value={feeBps} onChange={(e) => setFeeBps(e.target.value)} />
              </div>
              <div>
                <label className="zl-label">Treasury Address</label>
                <input className="zl-input" value={treasury} onChange={(e) => setTreasury(e.target.value)} placeholder="0x..." />
              </div>
            </div>
            <div>
              <label className="zl-label">Description</label>
              <textarea className="zl-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your wave program..." rows={4} />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <Button onClick={handleSubmit} disabled={submitting || !connected}>
                {submitting ? "Submitting..." : "Create Program"}
              </Button>
              {!connected && <Pill variant="warning">Connect wallet</Pill>}
            </div>
            {submitting && <p style={{ fontSize: 14, color: "var(--color-graphite)" }}>Sign transaction in wallet to deploy program.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
