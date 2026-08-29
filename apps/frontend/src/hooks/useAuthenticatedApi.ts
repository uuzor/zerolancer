import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.js";
import { api, API_BASE } from "../lib/api.js";

export function useAuthenticatedApi() {
  const { apiKey, github } = useAuth();

  const authApi = useMemo(() => {
    const getBearer = () => {
      if (apiKey) return apiKey;
      if (github?.token && github.token !== "placeholder") return github.token;
      return null;
    };

    return async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
      const bearer = getBearer();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(opts.headers as Record<string, string> | undefined),
      };
      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
      }
      return api<T>(path, { ...opts, headers });
    };
  }, [apiKey, github?.token]);

  return { authApi, API_BASE, hasBearer: !!(apiKey || (github?.token && github.token !== "placeholder")) };
}
