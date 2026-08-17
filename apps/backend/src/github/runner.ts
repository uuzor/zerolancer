import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { createLogger } from "../utils/logger.js";
import type { VerificationArtifact } from "@zerolance/config";
import { extractErrorMessage } from "../utils/response.js";

const exec = promisify(execCb);
const log = createLogger("github-runner");

const MAX_OUTPUT_BYTES = 8192;

function truncate(s: string): string {
  return s.length > MAX_OUTPUT_BYTES ? s.slice(0, MAX_OUTPUT_BYTES) + "…[truncated]" : s;
}

export interface GithubPrInput {
  repoUrl: string; // https://github.com/owner/repo
  prNumber: number;
  baseCommit?: string;
  headCommit?: string;
  sandboxImage?: string;
}

export interface GithubRunResult {
  prNumber: number;
  passed: boolean;
  artifacts: VerificationArtifact[];
}

function matchCoverage(stdout: string): number | undefined {
  // jest: "All files | 88.5 | ..."
  const jest = stdout.match(/All files\s*\|\s*([\d.]+)/);
  if (jest?.[1]) return Math.round(parseFloat(jest[1]) * 100);
  // lcov summary / nyc: "Lines : 88.5% ( 177/200 )"
  const nyc = stdout.match(/Lines\s*:?\s*([\d.]+)\s*%/i);
  if (nyc?.[1]) return Math.round(parseFloat(nyc[1]) * 100);
  // go test: "coverage: 88.5% of statements"
  const go = stdout.match(/coverage:\s*([\d.]+)%/i);
  if (go?.[1]) return Math.round(parseFloat(go[1]) * 100);
  return undefined;
}

async function runShell(cmd: string, cwd: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  try {
    const { stdout, stderr } = await exec(cmd, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number | null };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? extractErrorMessage(err),
      code: e.code ?? 1,
    };
  }
}

/// GitHub-native workflow runner: clones the PR, runs CI (lint/test/coverage),
/// and returns structured verification artifacts. This is the deterministic,
/// replayable half of the AI-verification pipeline.
///
/// NOTE: This runs the PR head in a sandbox shell. In production this is
/// replaced by an isolated container (configurable via ZERO_SANDBOX_IMAGE).
export class GithubRunner {
  constructor(
    private readonly timeoutMs: number = 300_000,
    private readonly sandboxImage: string = "node:22-alpine",
  ) {}

  async runPr(input: GithubPrInput): Promise<GithubRunResult> {
    const workdir = await mkdtemp(join(tmpdir(), "zerolance-pr-"));
    log.info("cloning PR", { repo: input.repoUrl, pr: input.prNumber, workdir });
    const artifacts: VerificationArtifact[] = [];

    try {
      // Shallow clone + fetch the PR ref.
      const clone = await runShell(
        `git clone --depth 50 --filter=blob:none "${input.repoUrl}" .`,
        workdir,
        60_000,
      );
      if (clone.code !== 0) {
        artifacts.push({
          kind: "ci",
          label: "git-clone",
          passed: false,
          detail: truncate(clone.stderr || clone.stdout),
        });
        return { prNumber: input.prNumber, passed: false, artifacts };
      }

      const fetch = await runShell(
        `git fetch origin pull/${input.prNumber}/head:pr-${input.prNumber} && git checkout pr-${input.prNumber}`,
        workdir,
        60_000,
      );
      if (fetch.code !== 0) {
        artifacts.push({
          kind: "ci",
          label: "git-checkout-pr",
          passed: false,
          detail: truncate(fetch.stderr || fetch.stdout),
        });
        return { prNumber: input.prNumber, passed: false, artifacts };
      }

      // Detect package manager + install deps.
      const installCmd = await this.detectInstallCmd(workdir);
      if (installCmd) {
        const install = await runShell(installCmd, workdir, 180_000);
        artifacts.push({
          kind: "ci",
          label: "install",
          passed: install.code === 0,
          detail: install.code === 0 ? "deps installed" : truncate(install.stderr),
        });
        if (install.code !== 0) {
          return { prNumber: input.prNumber, passed: false, artifacts };
        }
      }

      // Lint
      const lint = await runShell("npm run lint --if-present", workdir, 120_000);
      artifacts.push({
        kind: "lint",
        label: "lint",
        passed: lint.code === 0,
        detail: lint.code === 0 ? "lint passed" : truncate(lint.stderr || lint.stdout),
      });

      // Test + coverage
      const test = await runShell("npm test", workdir, this.timeoutMs);
      const coverage = matchCoverage(test.stdout);
      artifacts.push({
        kind: "coverage",
        label: "coverage",
        passed: test.code === 0,
        detail: test.code === 0 ? "tests passed" : truncate(test.stderr || test.stdout),
        metric: coverage,
      });

      const allPassed = artifacts.every((a) => a.passed);
      return { prNumber: input.prNumber, passed: allPassed, artifacts };
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }

  private async detectInstallCmd(cwd: string): Promise<string> {
    try {
      const { stdout } = await exec("ls package.json pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null", { cwd });
      const files = stdout.trim().split(/\s+/);
      if (files.includes("pnpm-lock.yaml")) return "pnpm install --frozen-lockfile";
      if (files.includes("yarn.lock")) return "yarn install --frozen-lockfile";
      if (files.includes("package-lock.json")) return "npm ci";
      if (files.includes("package.json")) return "npm install";
      return "";
    } catch {
      return "";
    }
  }
}

/// Write a minimal GitHub Actions workflow file that mirrors the runner's checks.
/// Clients can commit this to enable on-PR verification.
export async function writeZerolanceWorkflow(repoRoot: string): Promise<string> {
  const dir = join(repoRoot, ".github", "workflows");
  await mkdir(dir, { recursive: true });
  const path = join(dir, "zerolance-verify.yml");
  const content = `name: ZeroLance Verify
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
`;
  await writeFile(path, content, "utf-8");
  return path;
}

export function randomNonce(): `0x${string}` {
  return ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
}
