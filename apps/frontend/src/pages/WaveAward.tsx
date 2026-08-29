import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi.js";
import { Button, ErrorPane } from "../components/Alden.js";

export default function WaveAward() {
  const { programId, waveId } = useParams();
  const { authApi } = useAuthenticatedApi();
  const [builder, setBuilder] = useState("");
  const [points, setPoints] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId || !waveId) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi(`/v1/wave/program/${programId}/awarder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awarder: builder,
          allowed: points,
        }),
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Award failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="zl-section">
        <div className="zl-container" style={{ padding: "80px 32px" }}>
          <div className="zl-card">
            <h2 style={{ marginTop: 0 }}>Points Awarded</h2>
            <p style={{ color: "var(--color-graphite)" }}>Points have been recorded on-chain.</p>
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
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Award Points — Wave #{waveId}</h1>
        </div>

        <div className="zl-card">
          <p style={{ color: "var(--color-graphite)", fontSize: 14, marginTop: 0 }}>
            Award points to a builder for this wave. Points are granted on-chain via the program contract.
          </p>

          {error && <ErrorPane message={error} />}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640, marginTop: 24 }}>
            <div>
              <label className="zl-label">Program ID</label>
              <input className="zl-input" value={programId ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="zl-label">Wave ID</label>
              <input className="zl-input" value={waveId ?? ""} disabled readOnly />
            </div>
            <div>
              <label className="zl-label">Builder Address</label>
              <input className="zl-input" value={builder} onChange={(e) => setBuilder(e.target.value)} required placeholder="0x..." />
            </div>
            <div>
              <label className="zl-label">Points to Award</label>
              <input className="zl-input" type="number" value={points} onChange={(e) => setPoints(e.target.value)} required placeholder="100" />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Button type="submit" disabled={submitting}>{submitting ? "Awarding..." : "Award Points"}</Button>
              <Link to={`/programs/${programId}`}><Button variant="ghost" type="button">Cancel</Button></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
