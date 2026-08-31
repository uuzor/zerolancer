import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "../components/Alden.js";

export default function WaveApply() {
  const { programId } = useParams();
  const [teamName, setTeamName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
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
            <h2 style={{ marginTop: 0 }}>Application Submitted</h2>
            <p style={{ color: "var(--color-graphite)" }}>Application submitted. The program organizer will review your application.</p>
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
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Apply to Program</h1>
        </div>

        <div className="zl-card">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
            <div>
              <label className="zl-label">Program ID</label>
              <input className="zl-input" value={programId ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="zl-label">Team / Builder Name</label>
              <input className="zl-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} required placeholder="Your team or builder name" />
            </div>
            <div>
              <label className="zl-label">Repo URL</label>
              <input className="zl-input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} required placeholder="https://github.com/org/repo" />
            </div>
            <div>
              <label className="zl-label">Additional Requirements / Notes</label>
              <textarea className="zl-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Describe your experience, availability, and any special requirements." />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button type="submit">Submit Application</Button>
              <Link to={`/programs/${programId}`}><Button variant="ghost" type="button">Cancel</Button></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
