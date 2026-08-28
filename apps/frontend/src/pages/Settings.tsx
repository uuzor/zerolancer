import { useState, useEffect } from "react";
import { useConfig } from "../context/ConfigContext.js";
import { useAuth } from "../context/AuthContext.js";
import { Button, Pill, Empty } from "../components/Alden.js";

export default function Settings() {
  const config = useConfig();
  const { apiKey, devMode } = useAuth();
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || "");
  const [showDev, setShowDev] = useState(devMode);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApiKeyInput(apiKey || "");
    setShowDev(devMode);
  }, [apiKey, devMode]);

  const handleSaveApiKey = () => {
    localStorage.setItem("zl_api_key", apiKeyInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="zl-section">
      <div className="zl-container">
        <h1 style={{ fontSize: "var(--text-heading)", margin: 0 }}>Settings</h1>
        <p style={{ color: "var(--color-graphite)", marginTop: 8 }}>Manage your preferences and network settings.</p>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 32, maxWidth: 640 }}>
          <div className="zl-card">
            <h3 style={{ margin: "0 0 16px" }}>API Key</h3>
            <p style={{ fontSize: 14, color: "var(--color-graphite)", margin: "0 0 12px" }}>
              Optional client API key for service-account mode.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="zl-input"
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="ZERO_CLIENT_API_KEY"
              />
              <Button onClick={handleSaveApiKey}>Save</Button>
            </div>
            {saved && <p style={{ fontSize: 13, color: "#1b4332", marginTop: 8 }}>Saved to localStorage.</p>}
          </div>

          <div className="zl-card">
            <h3 style={{ margin: "0 0 16px" }}>Developer Mode</h3>
            <p style={{ fontSize: 14, color: "var(--color-graphite)", margin: "0 0 12px" }}>
              Show dev banner when auth is disabled.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="checkbox"
                checked={showDev}
                onChange={(e) => setShowDev(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span>{showDev ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          <div className="zl-card">
            <h3 style={{ margin: "0 0 16px" }}>Network</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>Chain ID</span>
                <span>{config.chainId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-graphite)", fontSize: 14 }}>RPC URL</span>
                <span style={{ fontSize: 13 }}>{config.rpcUrl}</span>
              </div>
            </div>
          </div>

          <div className="zl-card">
            <h3 style={{ margin: "0 0 16px" }}>Theme</h3>
            <Empty title="Not implemented" description="Theme customization is coming in a future release." />
          </div>
        </div>
      </div>
    </div>
  );
}
