import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Money, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

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

export default function WaveProjects() {
  const { programId, waveId } = useParams();
  const { connected } = useAuth();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [repoUrl, setRepoUrl] = useState("");
  const [repoHash, setRepoHash] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = waveId
      ? `/v1/wave/program/${programId}/projects?waveId=${waveId}`
      : `/v1/wave/program/${programId}/projects`;
    api<{ projects: ProjectInfo[] }>(url)
      .then((res) => {
        if (!cancelled) setProjects(res.projects ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [programId, waveId]);

  const handleCreate = async () => {
    if (!programId || !waveId || !connected) return;
    setCreateError(null);
    setSubmitting(true);
    try {
      await api(`/v1/wave/program/${programId}/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waveId: Number(waveId),
          builder: "",
          repoUrl,
          repoHash,
          description,
        }),
      });
      setShowCreate(false);
      setRepoUrl("");
      setRepoHash("");
      setDescription("");
      window.location.reload();
    } catch (e: any) {
      setCreateError(e.message ?? "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>
            {waveId ? `Wave #${waveId} Projects` : "All Projects"}
          </h1>
          <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>
            {waveId ? `Submissions for wave ${waveId} in program ${programId}.` : `All submissions for program ${programId}.`}
          </p>
        </div>
        {connected && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "New Project"}
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="zl-card" style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Submit Project</h3>
          {createError && <div style={{ padding: 12, background: "#fff5f5", border: "1px solid #f5d5d5", borderRadius: 8, marginBottom: 16, color: "#5c2a2a" }}>{createError}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <label className="zl-label">Repo URL</label>
              <input className="zl-input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" />
            </div>
            <div>
              <label className="zl-label">Repo Hash (bytes32)</label>
              <input className="zl-input" value={repoHash} onChange={(e) => setRepoHash(e.target.value)} placeholder="0x..." />
            </div>
            <div>
              <label className="zl-label">Description</label>
              <textarea className="zl-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your project..." rows={4} />
            </div>
            <Button onClick={handleCreate} disabled={submitting || !repoUrl || !repoHash}>
              {submitting ? "Submitting..." : "Submit Project"}
            </Button>
          </div>
        </div>
      )}

      <div className="zl-container" style={{ marginTop: 32 }}>
        {projects.length === 0 ? (
          <Empty title="No projects yet" description="Projects will appear here once builders submit." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {projects.map((p) => (
              <div key={p.id} className="zl-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: "1 1 240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Pill variant={p.status === "awarded" ? "success" : p.status === "rejected" ? "danger" : "default"}>{p.status}</Pill>
                    <span style={{ fontSize: 12, color: "var(--color-graphite)" }}>Wave #{p.waveId}</span>
                  </div>
                  {p.description && <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5 }}>{p.description}</p>}
                  <div style={{ fontSize: 13, color: "var(--color-graphite)" }}>
                    <Address value={p.builder} /> {p.team ? `· Team: ${p.team}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-graphite)", marginTop: 4 }}>
                    Submitted {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <a href={p.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Repo ↗</a>
                  {Number(p.pointsAwarded) > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.pointsAwarded} pts</div>
                  )}
                  <Link to={`/project/${p.id}`}><Button size="sm">View</Button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
