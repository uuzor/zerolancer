import { createContext, useContext, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { api } from "../lib/api.js";

export interface AuthContextValue {
  address: Address | null;
  chain: { id: number; name?: string } | null;
  connected: boolean;
  github: { login: string; token: string; avatarUrl: string } | null;
  principal: string | null;
  apiKey: string | null;
  devMode: boolean;
  setGithub: (g: { login: string; token: string; avatarUrl: string } | null) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  address: null,
  chain: null,
  connected: false,
  github: null,
  principal: null,
  apiKey: null,
  devMode: false,
  setGithub: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, chain, isConnected } = useAccount();
  const [github, setGithub] = useState<AuthContextValue["github"]>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("zl_github");
    if (stored) { try { setGithub(JSON.parse(stored)); } catch {} }
    const storedKey = localStorage.getItem("zl_api_key");
    if (storedKey) setApiKey(storedKey);
  }, []);

  useEffect(() => {
    if (github) localStorage.setItem("zl_github", JSON.stringify(github));
  }, [github]);

  useEffect(() => {
    if (apiKey) localStorage.setItem("zl_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    api<{ ok: boolean; principal?: string; devMode?: boolean }>("/health")
      .then((res) => {
        if (cancelled) return;
        setPrincipal(res.principal ?? null);
        setDevMode(Boolean(res.devMode));
      })
      .catch(() => { if (!cancelled) { setPrincipal(null); setDevMode(false); } });
    return () => { cancelled = true; };
  }, []);

  const value: AuthContextValue = {
    address: (address ?? null) as Address | null,
    chain: chain ? { id: chain.id, name: chain.name } : null,
    connected: isConnected && !!address,
    github,
    principal,
    apiKey,
    devMode,
    setGithub,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
