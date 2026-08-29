import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

export interface Config {
  chainId: number;
  rpcUrl: string;
  addresses: Record<string, string>;
  routes: Array<{ method: string; path: string; consumer: string; description: string }>;
}

export const ConfigContext = createContext<Config | null>(null);

export function useConfig(): Config {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    return {
      chainId: 0,
      rpcUrl: "",
      addresses: {},
      routes: [],
    };
  }
  return ctx;
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Config>("/v1/config")
      .then((c) => { if (!cancelled) setConfig(c); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="zl-container" style={{ padding: "40px 32px" }}>
        <p style={{ color: "red" }}>Failed to load config: {error}</p>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={config}>
      {!config ? (
        <div className="zl-container" style={{ padding: "40px 32px" }}>
          <p>Loading…</p>
        </div>
      ) : (
        children
      )}
    </ConfigContext.Provider>
  );
}
