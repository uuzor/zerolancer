import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ project: ProjectInfo }>(`/v1/wave/project/${projectId}`)
      .then((res) => {
        if (!cancelled) setProject(res.project ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;
  if (!project) return <div className="zl-container" style={{ padding: "40px 32px" }}><p>Project not found.</p></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to={`/programs/${project.programId}`} style={{ color: "var(--color-graphite)" }}>← Program</Link>
          <Link to={`/programs/${project.programId}/projects?waveId=${project.waveId}`} style={{ color: "var(--color-graphite)" }}>
            ← Wave #{project.waveId}
          </Link>
          <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Project</h1>
        </div>

        <div className="zl-card" style={{ marginBottom: 24 }}>
          <div className="zl-grid zl-grid--2">
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Status</span>
              <div style={{ marginTop: 4 }}><Pill variant={project.status === "awarded" ? "success" : project.status === "rejected" ? "danger" : "default"}>{project.status}</Pill></div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Builder</span>
              <div style={{ marginTop: 4 }}><Address value={project.builder} /></div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Team</span>
              <div style={{ marginTop: 4 }}>{project.team || "Solo"}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Points Awarded</span>
              <div style={{ marginTop: 4 }}>{project.pointsAwarded}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Description</span>
              <div style={{ marginTop: 4, lineHeight: 1.6 }}>{project.description || "No description provided."}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Repository</span>
              <div style={{ marginTop: 4 }}>
                <a href={project.repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>{project.repoUrl} ↗</a>
              </div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Repo Hash</span>
              <div style={{ marginTop: 4, fontSize: 12, fontFamily: "monospace" }}>{project.repoHash}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Content Hash</span>
              <div style={{ marginTop: 4, fontSize: 12, fontFamily: "monospace" }}>{project.contentHash || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Created</span>
              <div style={{ marginTop: 4 }}>{new Date(project.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Updated</span>
              <div style={{ marginTop: 4 }}>{new Date(project.updatedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
