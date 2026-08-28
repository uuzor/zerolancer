const API_BASE =
  (import.meta as any).env?.VITE_API_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "");

export async function api<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`) as any;
    err.status = res.status;
    err.code = data?.code;
    err.body = data;
    throw err;
  }
  return data as T;
}

export { API_BASE };
