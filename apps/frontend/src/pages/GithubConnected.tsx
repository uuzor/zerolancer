import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Button, Pill } from "../components/Alden.js";

export default function GithubConnected() {
  const { setGithub } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const login = params.get("login");
  const token = params.get("token");

  useEffect(() => {
    if (login) {
      setGithub({ login, token: token ?? "", avatarUrl: "" });
    }
  }, [login, token, setGithub]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--spacing-32)" }}>
      <div className="zl-card" style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <h1 className="zl-text-heading" style={{ margin: 0, lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }}>
          GitHub <span style={{ color: "var(--color-sky-highlight)" }}>Connected</span>
        </h1>

        {login ? (
          <>
            <Pill variant="success" style={{ marginTop: 16 }}>Linked</Pill>
            <p style={{ color: "var(--color-graphite)", marginTop: 16 }}>
              Successfully connected as <strong>{login}</strong>.
            </p>
            <div style={{ marginTop: 32 }}>
              <Button onClick={() => navigate("/github")}>Go to GitHub Settings</Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--color-graphite)", marginTop: 16 }}>
              Connecting your GitHub account...
            </p>
            <div style={{ marginTop: 32 }}>
              <Button onClick={() => navigate("/github")}>Go to GitHub Settings</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
