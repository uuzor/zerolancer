import { useState, useEffect } from "react";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { api } from "../lib/api.js";
import { Button, Pill, Address, Empty, LoadingRows, ErrorPane } from "../components/Alden.js";

export interface RepoInfo {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

export default function Github() {
  const config = useConfig();
  const { github, connected } = useAuth();
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!github?.token) return;
    let cancelled = false;
    setLoading(true);
    api<{ repos: RepoInfo[] }>("/v1/github/repos", {
      headers: { Authorization: `Bearer ${github.token}` },
    })
      .then((res) => {
        if (!cancelled) setRepos(res.repos ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [github?.token]);

  const handleConnect = () => {
    setConnecting(true);
    api<{ authUrl: string }>("/v1/github/auth/start?redirect=/github")
      .then((res) => {
        window.location.href = res.authUrl;
      })
      .catch((e) => {
        alert(e.message ?? "Failed to start GitHub auth");
        setConnecting(false);
      });
  };

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>GitHub</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Connect your GitHub account to link repos to tasks.</p>

        <div className="zl-card" style={{ marginTop: 32 }}>
          {github ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {github.avatarUrl && <img src={github.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />}
              <div>
                <div style={{ fontWeight: 600 }}>{github.login}</div>
                <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>Connected</div>
              </div>
              <Pill variant="success">Linked</Pill>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Not connected</div>
                <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>Link a GitHub account to enable repo integration.</div>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect GitHub"}
              </Button>
            </div>
          )}
        </div>

        {github && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: "var(--text-subheading)", margin: "0 0 16px" }}>Linked Repos</h2>
            {repos.length === 0 ? (
              <div className="zl-card"><Empty title="No repos linked" description="Connect a repo to a task to see it here." /></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {repos.map((repo) => (
                  <div key={repo.id} className="zl-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{repo.fullName}</div>
                      <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>{repo.private ? "Private" : "Public"}</div>
                    </div>
                    <a href={repo.htmlUrl} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>View on GitHub →</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
