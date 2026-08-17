import type { Hex } from "viem";
import {
  buildVerificationResult,
  deliverableHashOf,
} from "@zerolance/shared";
import type {
  VerificationResult,
  VerificationArtifact,
} from "@zerolance/config";
import { createLogger } from "../utils/logger.js";
import { GithubRunner } from "../github/runner.js";
import { GithubClient, parseRepoRef, safeGithubError } from "../github/client.js";
import { getGithubStore } from "../github/store.js";
import type { OracleClient } from "../oracle/client.js";
import { extractErrorMessage } from "../utils/response.js";

const log = createLogger("verdict-orchestrator");

export interface VerifyInput {
  taskId: bigint;
  deliverableRef: string; // PR URL
  prNumber?: number;
  repoUrl?: string;
  coverageGateBps?: number;
}

export interface VerifyOutput {
  verification: VerificationResult;
  signature: Hex;
  signer: Hex;
  nonce: Hex;
  validUntil: string;
}

/// The AI-verified-escrow orchestrator. Combines:
///   1. deterministic GitHub runner (CI: lint, test, coverage)
///   2. AI scoring (LLM brand/community/design checks via 0G Compute)
/// into a single VerificationResult, then asks the oracle to sign the verdict.
export class VerdictOrchestrator {
  private readonly github: GithubClient | null;

  constructor(
    private readonly oracle: OracleClient,
    private readonly runner: GithubRunner,
    private readonly defaultCoverageGateBps: number = 8000,
    github?: GithubClient,
  ) {
    this.github = github ?? null;
  }

  async verify(input: VerifyInput): Promise<VerifyOutput> {
    log.info("verifying deliverable", {
      taskId: input.taskId.toString(),
      ref: input.deliverableRef,
    });

    const artifacts: VerificationArtifact[] = [];

    // 1. Fetch real GitHub PR + CI check status (if a connection exists).
    const githubArtifacts = await this.fetchGithubStatus(input);
    artifacts.push(...githubArtifacts);

    // 2. Deterministic CI run (if a PR is available and GitHub checks
    //    are unavailable — local sandbox clone as a fallback).
    if (
      input.repoUrl &&
      input.prNumber &&
      !githubArtifacts.some((a) => a.label === "github-checks")
    ) {
      try {
        const run = await this.runner.runPr({
          repoUrl: input.repoUrl,
          prNumber: input.prNumber,
        });
        artifacts.push(...run.artifacts);
      } catch (err) {
        log.warn("github runner failed", {
          error: extractErrorMessage(err),
          taskId: input.taskId.toString(),
        });
        artifacts.push({
          kind: "ci",
          label: "github-runner",
          passed: false,
          detail: `runner error: ${extractErrorMessage(err)}`,
        });
      }
    }

    // 2. AI scoring (optional, non-blocking on failure).
    const aiArtifact = await this.aiScore(input).catch((err) => {
      log.warn("AI scoring failed", { error: extractErrorMessage(err) });
      return {
        kind: "llm-similarity" as const,
        label: "ai-review",
        passed: false,
        detail: `ai scoring unavailable: ${extractErrorMessage(err)}`,
      };
    });
    artifacts.push(aiArtifact);

    const coverageGate = input.coverageGateBps ?? this.defaultCoverageGateBps;
    const verification = buildVerificationResult(
      input.taskId,
      input.deliverableRef,
      artifacts,
      coverageGate,
    );

    // 3. Ask the oracle to sign the verdict (EIP-712).
    const signed = await this.oracle.signVerdict({
      taskId: input.taskId,
      deliverableHash: verification.deliverableHash,
      passed: verification.passed,
      score: verification.score,
    });

    log.info("verdict signed", {
      taskId: input.taskId.toString(),
      passed: verification.passed,
      score: verification.score.toString(),
      signer: signed.signer,
    });

    return {
      verification,
      signature: signed.signature,
      signer: signed.signer,
      nonce: signed.nonce,
      validUntil: signed.validUntil,
    };
  }

  /// Fetch real GitHub PR + CI check status using a linked OAuth token.
  /// Produces two artifacts when available: "github-merge" (PR merged) and
  /// "github-checks" (CI checks all green). Returns [] if no GitHub client
  /// or no linked repo/PR exists for the task.
  private async fetchGithubStatus(input: VerifyInput): Promise<VerificationArtifact[]> {
    if (!this.github) return [];
    const store = getGithubStore();
    const conn = store.getConnection(input.taskId);
    if (!conn) {
      // Fall back to parsing the deliverableRef as a PR URL if no connection.
      if (input.repoUrl && input.prNumber) return [];
      return [];
    }
    if (!conn.prNumber) return [];
    // Use the linked account's token; in production this would be the task
    // creator's token or a GitHub App installation token.
    const account = store.getAccount(conn.connectedBy);
    const token = account?.accessToken ?? undefined;
    if (!token) {
      log.warn("no github token for linked account", { login: conn.connectedBy });
      return [];
    }
    try {
      const status = await this.github.getPrStatus(
        token,
        conn.owner,
        conn.repo,
        conn.prNumber,
      );
      const out: VerificationArtifact[] = [];
      out.push({
        kind: "ci",
        label: "github-merge",
        passed: status.merged,
        detail: status.merged
          ? `merged by ${status.pr.mergedBy?.login ?? "unknown"} at ${status.pr.mergedAt}`
          : `PR state: ${status.pr.state}${status.pr.draft ? " (draft)" : ""}`,
      });
      out.push({
        kind: "ci",
        label: "github-checks",
        passed: status.checks.allGreen,
        detail: `${status.checks.passed}/${status.checks.completed} checks passed, ${status.checks.failed} failed, ${status.checks.pending} pending`,
        metric: status.checks.total > 0
          ? Math.round((status.checks.passed / status.checks.total) * 100_000)
          : undefined,
      });
      return out;
    } catch (err) {
      log.warn("github status fetch failed", {
        error: extractErrorMessage(err),
        taskId: input.taskId.toString(),
      });
      return [
        {
          kind: "ci",
          label: "github-checks",
          passed: false,
          detail: `github status unavailable: ${extractErrorMessage(safeGithubError(err))}`,
        },
      ];
    }
  }

  /// AI scoring via the 0G Compute router. Falls back to a pass with a warning
  /// if no compute key is configured (deterministic CI alone decides the verdict).
  private async aiScore(input: VerifyInput): Promise<VerificationArtifact> {
    if (
      !process.env.ZERO_COMPUTE_API_KEY &&
      !process.env.OG_COMPUTE_API_KEY &&
      !process.env.ZERO_COMPUTE_DIRECT_KEY
    ) {
      return {
        kind: "llm-similarity",
        label: "ai-review",
        passed: true,
        detail: "AI scoring skipped (no compute key); relying on CI gates",
      };
    }
    const { createRouterClient } = await import("../compute/index.js");
    const model = process.env.ZERO_COMPUTE_MODEL ?? "0gm-1.0-35b-a3b";
    const client = await createRouterClient(model);
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior code reviewer. Score the deliverable 0-100. Reply JSON: {\"score\":number,\"passed\":boolean,\"reason\":string}",
        },
        {
          role: "user",
          content: `Review deliverable for task ${input.taskId.toString()}: ${input.deliverableRef}`,
        },
      ],
      temperature: 0.2,
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { score?: number; passed?: boolean; reason?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* malformed — treat as a soft pass */
    }
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    return {
      kind: "llm-similarity",
      label: "ai-review",
      passed: parsed.passed ?? score >= 60,
      detail: parsed.reason ?? "AI review complete",
      metric: score * 100,
    };
  }
}

export { deliverableHashOf };
