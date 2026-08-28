import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { ZEROLANCE_WAVE_ISSUE_ABI } from "../abis.js";
import { useWriteContract } from "wagmi";
import { Button, Pill, Empty } from "../components/Alden.js";

export default function IssueCreate() {
  const navigate = useNavigate();
  const config = useConfig();
  const { connected } = useAuth();
  const { writeContract, isPending } = useWriteContract();
  const issueAddress = config.addresses.waveIssue;

  const [programId, setProgramId] = useState("");
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [basePoints, setBasePoints] = useState("10");
  const [complexity, setComplexity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  if (!issueAddress) {
    return (
      <div className="zl-container" style={{ padding: "80px 32px" }}>
        <Empty title="Issues not configured" description="Wave issue contracts are not deployed on this network." />
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    try {
      writeContract({
        address: issueAddress as `0x${string}`,
        abi: ZEROLANCE_WAVE_ISSUE_ABI,
        functionName: "createIssue",
        args: [
          BigInt(programId),
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          BigInt(basePoints),
          BigInt(complexity),
        ],
      });
      navigate("/issues");
    } catch (e: any) {
      setError(e.message ?? "Transaction failed");
    }
  };

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Create Issue</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Create a new wave-funded issue.</p>

        {error && <div className="zl-card" style={{ marginTop: 24, borderColor: "#f5d5d5", background: "#fff5f5" }}><p style={{ color: "#5c2a2a", margin: 0 }}>{error}</p></div>}

        <div className="zl-card" style={{ marginTop: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
            <div>
              <label className="zl-label">Program ID</label>
              <input className="zl-input" type="number" value={programId} onChange={(e) => setProgramId(e.target.value)} />
            </div>
            <div>
              <label className="zl-label">Repo (owner/repo)</label>
              <input className="zl-input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
            </div>
            <div>
              <label className="zl-label">Title</label>
              <input className="zl-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="zl-label">Body</label>
              <textarea className="zl-textarea" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="zl-label">Base Points (1–200)</label>
                <input className="zl-input" type="number" min={1} max={200} value={basePoints} onChange={(e) => setBasePoints(e.target.value)} />
              </div>
              <div>
                <label className="zl-label">Complexity (1–3)</label>
                <input className="zl-input" type="number" min={1} max={3} value={complexity} onChange={(e) => setComplexity(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <Button onClick={handleSubmit} disabled={isPending || !connected}>
                {isPending ? "Signing..." : "Create Issue"}
              </Button>
              {!connected && <Pill variant="warning">Connect wallet</Pill>}
            </div>
            {isPending && <p style={{ fontSize: 14, color: "var(--color-graphite)" }}>Sign transaction in wallet to create issue.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
