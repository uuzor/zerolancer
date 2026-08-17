import { createLogger } from "./logger.js";

const log = createLogger("fetch-json");

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.warn("fetch failed", { url, status: res.status, body: text.slice(0, 200) });
    throw new Error(`fetch ${url} returned ${res.status}`);
  }
  return (await res.json()) as T;
}
