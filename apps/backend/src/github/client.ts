import { createLogger } from "../utils/logger.js";
import { extractErrorMessage } from "../utils/response.js";

const log = createLogger("github-client");

const API_BASE = "https://api.github.com";
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

export interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GithubRepo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
  permissions?: { admin: boolean; push: boolean; pull: boolean };
}

export interface GithubPrUser {
  login: string;
  htmlUrl: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GithubPrUser | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  htmlUrl: string;
  user: GithubPrUser;
  createdAt: string;
  updatedAt: string;
}

export type CheckStatus = "queued" | "in_progress" | "completed";
export type CheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | null;

export interface GithubCheckRun {
  id: number;
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion;
  htmlUrl: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PrCheckSummary {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  pending: number;
  allGreen: boolean;
  checkRuns: GithubCheckRun[];
}

export interface GithubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  htmlUrl: string;
  body: string | null;
}

/// Low-level GitHub REST API client. Authenticates per-request with either a
/// user OAuth token or a fallback PAT (ZERO_GITHUB_TOKEN). All responses are
/// mapped to plain domain objects so callers never touch the raw API shape.
export class GithubClient {
  private readonly pat: string | undefined;

  constructor(opts: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    pat?: string;
  }) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.redirectUri = opts.redirectUri;
    this.pat = opts.pat;
  }

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /// Build the GitHub OAuth authorize URL for the "connect account" flow.
  buildAuthorizeUrl(state: string, scopes = "repo read:user"): string {
    if (!this.clientId) {
      throw new Error("ZERO_GITHUB_OAUTH_CLIENT_ID not configured");
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri ?? "",
      scope: scopes,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /// Exchange the OAuth code from the callback for an access token.
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    tokenType: string;
    scope: string;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("GitHub OAuth client credentials not configured");
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri ?? "",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GitHub token exchange failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!body.access_token) {
      throw new Error(
        `GitHub token exchange error: ${body.error ?? "unknown"} — ${body.error_description ?? ""}`,
      );
    }
    return {
      accessToken: body.access_token,
      tokenType: body.token_type ?? "bearer",
      scope: body.scope ?? "",
    };
  }

  async getUser(token: string): Promise<GithubUser> {
    const raw = (await this.request(token, "GET", "/user")) as Record<string, unknown>;
    return {
      id: raw.id as number,
      login: raw.login as string,
      name: (raw.name as string | null) ?? null,
      avatarUrl: raw.avatar_url as string,
      htmlUrl: raw.html_url as string,
    };
  }

  async listRepos(
    token: string,
    opts: { affiliation?: string; perPage?: number; page?: number } = {},
  ): Promise<GithubRepo[]> {
    const params = new URLSearchParams({
      sort: "updated",
      direction: "desc",
      per_page: String(opts.perPage ?? 50),
      page: String(opts.page ?? 1),
    });
    if (opts.affiliation) params.set("affiliation", opts.affiliation);
    const raw = (await this.request(token, "GET", `/user/repos?${params}`)) as unknown[];
    return raw.map((r) => this.mapRepo(r as Record<string, unknown>));
  }

  async getRepo(token: string, owner: string, repo: string): Promise<GithubRepo> {
    const raw = (await this.request(token, "GET", `/repos/${owner}/${repo}`)) as Record<string, unknown>;
    return this.mapRepo(raw);
  }

  async getIssue(
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GithubIssue> {
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
    )) as Record<string, unknown>;
    return {
      number: raw.number as number,
      title: raw.title as string,
      state: raw.state as "open" | "closed",
      htmlUrl: raw.html_url as string,
      body: (raw.body as string | null) ?? null,
    };
  }

  /// Create a new issue in a repository. Returns the created issue.
  async createIssue(
    token: string,
    owner: string,
    repo: string,
    opts: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
    },
  ): Promise<GithubIssue> {
    const payload: Record<string, unknown> = { title: opts.title };
    if (opts.body !== undefined) payload.body = opts.body;
    if (opts.labels?.length) payload.labels = opts.labels;
    if (opts.assignees?.length) payload.assignees = opts.assignees;
    const raw = (await this.request(
      token,
      "POST",
      `/repos/${owner}/${repo}/issues`,
      payload,
    )) as Record<string, unknown>;
    return {
      number: raw.number as number,
      title: raw.title as string,
      state: raw.state as "open" | "closed",
      htmlUrl: raw.html_url as string,
      body: (raw.body as string | null) ?? null,
    };
  }

  /// Close (or reopen) an issue. Returns the updated issue.
  async updateIssueState(
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
    state: "open" | "closed",
  ): Promise<GithubIssue> {
    const raw = (await this.request(
      token,
      "PATCH",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      { state },
    )) as Record<string, unknown>;
    return {
      number: raw.number as number,
      title: raw.title as string,
      state: raw.state as "open" | "closed",
      htmlUrl: raw.html_url as string,
      body: (raw.body as string | null) ?? null,
    };
  }

  /// List issues for a repo (optionally filtered by state).
  async listIssues(
    token: string,
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
  ): Promise<GithubIssue[]> {
    const params = new URLSearchParams({
      state,
      sort: "created",
      direction: "desc",
      per_page: "30",
    });
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/issues?${params}`,
    )) as unknown[];
    // Filter out PRs (which appear in the issues endpoint)
    return raw
      .filter((i) => !((i as Record<string, unknown>).pull_request))
      .map((i) => {
        const raw = i as Record<string, unknown>;
        return {
          number: raw.number as number,
          title: raw.title as string,
          state: raw.state as "open" | "closed",
          htmlUrl: raw.html_url as string,
          body: (raw.body as string | null) ?? null,
        };
      });
  }

  async getPullRequest(
    token: string,
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<GithubPullRequest> {
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
    )) as Record<string, unknown>;
    return this.mapPr(raw);
  }

  /// Find the most recent open PR whose head ref matches a branch name.
  async findPrByBranch(
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<GithubPullRequest | null> {
    const params = new URLSearchParams({
      state: "all",
      head: `${owner}:${branch}`,
      sort: "updated",
      direction: "desc",
      per_page: "5",
    });
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/pulls?${params}`,
    )) as unknown[];
    const items = raw.map((p) => this.mapPr(p as Record<string, unknown>));
    return items[0] ?? null;
  }

  /// List PRs for a repo (optionally filtered by state).
  async listPullRequests(
    token: string,
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
  ): Promise<GithubPullRequest[]> {
    const params = new URLSearchParams({
      state,
      sort: "updated",
      direction: "desc",
      per_page: "30",
    });
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/pulls?${params}`,
    )) as unknown[];
    return raw.map((p) => this.mapPr(p as Record<string, unknown>));
  }

  /// Get the CI check-run summary for a PR's head commit.
  async getCheckRuns(
    token: string,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<PrCheckSummary> {
    const params = new URLSearchParams({ per_page: "100" });
    const raw = (await this.request(
      token,
      "GET",
      `/repos/${owner}/${repo}/commits/${ref}/check-runs?${params}`,
    )) as { check_runs?: unknown[] };
    const runs = (raw.check_runs ?? []).map((r) =>
      this.mapCheckRun(r as Record<string, unknown>),
    );
    const completed = runs.filter((r) => r.status === "completed");
    const passed = completed.filter((r) => r.conclusion === "success").length;
    const failed = completed.filter(
      (r) => r.conclusion && r.conclusion !== "success" && r.conclusion !== "neutral",
    ).length;
    const pendingCount = runs.length - completed.length;
    return {
      total: runs.length,
      completed: completed.length,
      passed,
      failed,
      pending: pendingCount,
      allGreen: runs.length > 0 && failed === 0 && pendingCount === 0,
      checkRuns: runs,
    };
  }

  /// Combined PR + checks snapshot used by the verdict orchestrator and the
  /// /github/task/:id/sync endpoint.
  async getPrStatus(
    token: string,
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<{
    pr: GithubPullRequest;
    checks: PrCheckSummary;
    merged: boolean;
  }> {
    const pr = await this.getPullRequest(token, owner, repo, prNumber);
    const checks = await this.getCheckRuns(token, owner, repo, pr.headSha);
    return { pr, checks, merged: pr.merged };
  }

  // -- internals ---------------------------------------------------------

  private async request(
    token: string | undefined,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const auth = token ?? this.pat;
    if (!auth) throw new Error("no GitHub token available (OAuth or ZERO_GITHUB_TOKEN)");
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ZeroLance-Backend",
      },
    };
    if (body !== undefined) {
      init.headers = { ...init.headers as Record<string, string>, "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    if (res.status === 404) {
      throw new Error(`GitHub 404: ${path}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.warn("github api error", { path, status: res.status, body: text.slice(0, 200) });
      throw new Error(`GitHub API ${method} ${path} failed (${res.status}): ${text.slice(0, 150)}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  private mapRepo(r: Record<string, unknown>): GithubRepo {
    const owner = (r.owner as { login?: string } | undefined)?.login ?? "";
    const name = r.name as string;
    return {
      id: r.id as number,
      owner,
      name,
      fullName: r.full_name as string,
      htmlUrl: r.html_url as string,
      cloneUrl: r.clone_url as string,
      private: r.private as boolean,
      defaultBranch: r.default_branch as string,
      permissions: r.permissions as GithubRepo["permissions"],
    };
  }

  private mapPr(p: Record<string, unknown>): GithubPullRequest {
    const user = p.user as { login: string; html_url: string } | null;
    const mergedBy = p.merged_by as { login: string; html_url: string } | null;
    const head = p.head as { sha: string; ref: string };
    const base = p.base as { ref: string };
    return {
      number: p.number as number,
      title: p.title as string,
      state: p.state as "open" | "closed",
      draft: p.draft as boolean,
      merged: p.merged as boolean,
      mergedAt: (p.merged_at as string | null) ?? null,
      mergedBy: mergedBy
        ? { login: mergedBy.login, htmlUrl: mergedBy.html_url }
        : null,
      headSha: head.sha,
      headRef: head.ref,
      baseRef: base.ref,
      htmlUrl: p.html_url as string,
      user: user
        ? { login: user.login, htmlUrl: user.html_url }
        : { login: "", htmlUrl: "" },
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
    };
  }

  private mapCheckRun(r: Record<string, unknown>): GithubCheckRun {
    return {
      id: r.id as number,
      name: r.name as string,
      status: r.status as CheckStatus,
      conclusion: (r.conclusion as CheckConclusion) ?? null,
      htmlUrl: (r.html_url as string | null) ?? "",
      startedAt: (r.started_at as string | null) ?? null,
      completedAt: (r.completed_at as string | null) ?? null,
    };
  }

  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private redirectUri: string | undefined;
}

/// Parse "owner/repo" from a GitHub URL or shorthand.
export function parseRepoRef(input: string): { owner: string; repo: string } | null {
  const m = input.match(/github\.com[/:]([^/]+)\/([^/)#?.]+)/i);
  if (m?.[1] && m[2]) return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
  const short = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (short?.[1] && short[2]) return { owner: short[1], repo: short[2].replace(/\.git$/, "") };
  return null;
}

export function repoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

export function safeGithubError(err: unknown): Error {
  const msg = extractErrorMessage(err);
  if (msg.includes("404")) return new Error("GitHub resource not found");
  return err instanceof Error ? err : new Error(msg);
}
