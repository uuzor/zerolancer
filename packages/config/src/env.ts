import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

function findEnvFile(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadEnv(startDir?: string): void {
  const file = findEnvFile(startDir);
  if (!file) return;
  const parsed = parseEnvFile(file);
  for (const [key, val] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export function getEnvWithAlias(key: string, aliases: string[]): string | undefined {
  const v = process.env[key];
  if (v !== undefined) return v;
  for (const alias of aliases) {
    const av = process.env[alias];
    if (av !== undefined) return av;
  }
  return undefined;
}
