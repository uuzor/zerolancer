import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "../components/Alden.js";

export default function WaveSubmit() {
  const { programId, waveId } = useParams();
  const [contentHash, setContentHash] = useState("");
  const [repoHash, setRepoHash] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="zl-section">
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <div className="zl-card">
            <h2 style={{ marginTop: 0 }}>Submission Received</h2>
            <p style={{ color: "var(--color-graphite)" }}>Submission received. Points will be awarded after evaluation.</p>
            <Link to={`/programs/${programId}`}><Button variant="ghost">Back to Program</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to={`/programs/${programId}`} style={{ color: "var(--color-graphite)" }}>← Program #{programId}</Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Submit to Wave #{waveId}</h1>
        </div>

        <div className="zl-card">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
            <div>
              <label className="zl-label">Program ID</label>
              <input className="zl-input" value={programId ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="zl-label">Wave ID</label>
              <input className="zl-input" value={waveId ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="zl-label">Content Hash</label>
              <input className="zl-input" value={contentHash} onChange={(e) => setContentHash(e.target.value)} required placeholder="0x..." />
            </div>
            <div>
              <label className="zl-label">Repo Hash (keccak256 of repo URL)</label>
              <input className="zl-input" value={repoHash} onChange={(e) => setRepoHash(e.target.value)} required placeholder="0x..." />
            </div>
            <div>
              <label className="zl-label">Additional Notes</label>
              <textarea className="zl-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Describe your submission, approach, and any relevant details." />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button type="submit">Submit to Wave</Button>
              <Link to={`/programs/${programId}`}><Button variant="ghost" type="button">Cancel</Button></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
