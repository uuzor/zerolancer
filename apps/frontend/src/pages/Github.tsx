import { useState, useEffect } from "react";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi.js";
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
  const { github, setGithub, connected } = useAuth();
  const { authApi, hasBearer } = useAuthenticatedApi();
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [me, setMe] = useState<{ login: string; name: string; avatarUrl: string; htmlUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!hasBearer) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      authApi<{ login: string; name: string; avatarUrl: string; htmlUrl: string }>("/v1/github/me"),
      authApi<{ repos: RepoInfo[] }>("/v1/github/repos"),
    ])
      .then(([meRes, reposRes]) => {
        if (!cancelled) {
          setMe(meRes);
          setRepos(reposRes.repos ?? []);
          if (meRes.login && (!github || github.login !== meRes.login)) {
            setGithub({
              login: meRes.login,
              token: github?.token ?? "placeholder",
              avatarUrl: meRes.avatarUrl,
            });
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hasBearer, authApi, setGithub, github?.token]);

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = `/v1/github/auth/start?redirect=${encodeURIComponent("/github/connected")}`;
  };

  if (error) return <ErrorPane message={error} retry={() => window.location.reload()} />;
  if (loading) return <div className="zl-container" style={{ padding: "40px 32px" }}><LoadingRows count={4} /></div>;

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>GitHub</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Connect your GitHub account to link repos to tasks.</p>

        <div className="zl-card" style={{ marginTop: 32 }}>
          {me ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {me.avatarUrl && <img src={me.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />}
              <div>
                <div style={{ fontWeight: 600 }}>{me.name ?? me.login}</div>
                <div style={{ fontSize: 14, color: "var(--color-graphite)" }}>@{me.login}</div>
              </div>
              <Pill variant="success">Linked</Pill>
            </div>
          ) : github ? (
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
              <Button onClick={handleConnect} disabled={connecting || !connected}>
                {connecting ? "Connecting..." : "Connect GitHub"}
              </Button>
            </div>
          )}
        </div>

        {!hasBearer && !github && (
          <div className="zl-card" style={{ marginTop: 24, padding: "24px 40px" }}>
            <p style={{ color: "var(--color-graphite)", margin: 0 }}>
              <strong>API key required for GitHub.</strong> Add your <code className="zl-code">ZERO_CLIENT_API_KEY</code> in <a href="/settings" style={{ textDecoration: "underline" }}>Settings</a> to enable GitHub API access.
            </p>
          </div>
        )}

        {github && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: "var(--text-subheading)", margin: "0 0 16px" }}>Linked Repos</h2>
            {repos.length === 0 ? (
              <div className="zl-card"><Empty title="No repos found" description="Connect a repo to a task to see it here." /></div>
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
