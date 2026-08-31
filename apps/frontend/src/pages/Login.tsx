import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useAuth } from "../context/AuthContext.js";
import { Button, Pill } from "../components/Alden.js";

export default function Login() {
  const { isConnected } = useAccount();
  const { setGithub, principal, devMode } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loginParam, setLoginParam] = useState<string | null>(null);

  useEffect(() => {
    const login = params.get("login");
    const token = params.get("token");
    if (login) {
      setLoginParam(login);
      setGithub({ login, token: token ?? "", avatarUrl: "" });
    }
  }, [params, setGithub]);

  useEffect(() => {
    if (isConnected) navigate("/marketplace", { replace: true });
  }, [isConnected, navigate]);

  const handleGithubConnect = () => {
    const redirect = "/login";
    window.location.href = `/v1/github/auth/start?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--spacing-32)" }}>
      <div className="zl-card" style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <h1 className="zl-text-heading" style={{ margin: 0, lineHeight: "var(--leading-heading)", letterSpacing: "var(--tracking-heading)" }}>
          Welcome to <span style={{ color: "var(--color-sky-highlight)" }}>ZeroLance</span>
        </h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 12 }}>
          Connect your wallet and GitHub to start building or hiring on-chain.
        </p>

        {devMode && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#fef3c7", borderRadius: "var(--radius-cards)", color: "#5c3d0a", fontSize: 14 }}>
            Development mode — auth disabled
          </div>
        )}

        {principal && (
          <div style={{ marginTop: 16 }}>
            <Pill variant="accent">Principal: {principal}</Pill>
          </div>
        )}

        {loginParam && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#d8f3dc", borderRadius: "var(--radius-cards)", color: "#1b4332", fontSize: 14 }}>
            GitHub connected as <strong>{loginParam}</strong>
          </div>
        )}

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
          <Button variant="ghost" onClick={handleGithubConnect}>
            Connect GitHub
          </Button>
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: "var(--color-graphite)" }}>
          By connecting, you agree to our terms. Wallet is required for all writes.
        </p>
      </div>
    </div>
  );
}
