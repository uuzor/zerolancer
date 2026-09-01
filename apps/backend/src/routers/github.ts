import type { Router, Request, Response } from "express";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import { HTTP } from "@zerolance/config";
import { createLogger } from "../utils/logger.js";
import { sendError, extractErrorMessage } from "../utils/response.js";
import { broadcast } from "../ws/broadcaster.js";
import {
  GithubClient,
  parseRepoRef,
  repoUrl,
  safeGithubError,
} from "../github/client.js";
import {
  getGithubStore,
  verifyWebhookSignature,
  type GithubAccount,
} from "../github/store.js";
import type { ServerConfig } from "../server.js";

const log = createLogger("github-router");

const connectRepoSchema = z.object({
  taskId: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  repo: z.string().min(1).max(512),
  issueNumber: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
});

const linkPrSchema = z.object({
  prNumber: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
});

const createIssueSchema = z.object({
  repo: z.string().min(1).max(512),
  title: z.string().min(1).max(512),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().max(100)).max(20).optional(),
  assignees: z.array(z.string().max(100)).max(10).optional(),
});

const updateIssueStateSchema = z.object({
  repo: z.string().min(1).max(512),
  number: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]),
  state: z.enum(["open", "closed"]),
});

const taskIssueSchema = z.object({
  title: z.string().min(1).max(512),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().max(100)).max(20).optional(),
  assignees: z.array(z.string().max(100)).max(10).optional(),
});

/// Extract & validate a GitHub OAuth account from the Authorization: Bearer header.
/// Falls back to a PAT-based service account when the server API key is used
/// and ZERO_GITHUB_TOKEN is configured (enables testing without OAuth).
function resolveAccount(req: Request, res: Response, config: ServerConfig): GithubAccount | null {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    sendError(res, HTTP.UNAUTHORIZED, "GitHub Bearer token required", "GITHUB_AUTH_REQUIRED");
    return null;
  }
  const account = getGithubStore().getAccountByToken(token);
  if (account) return account;

  // PAT service-account mode: if the bearer matches the server API key (never
  // the weaker client key) and a GitHub PAT is configured, synthesize a
  // service account. Server-to-server only.
  const pat = config.env.ZERO_GITHUB_TOKEN;
  if (pat && token === config.env.ZERO_API_KEY) {
    return {
      githubId: 0,
      login: "service-account",
      name: "ZeroLance Service Account",
      avatarUrl: "",
      htmlUrl: "",
      accessToken: pat,
      scope: "repo",
      connectedAt: new Date().toISOString(),
    };
  }

  sendError(res, HTTP.UNAUTHORIZED, "GitHub account not linked", "GITHUB_NOT_LINKED");
  return null;
}

export function registerGithubRoutes(app: Router, config: ServerConfig): void {
  const gh = new GithubClient({
    clientId: config.env.ZERO_GITHUB_OAUTH_CLIENT_ID,
    clientSecret: config.env.ZERO_GITHUB_OAUTH_CLIENT_SECRET,
    redirectUri: config.env.ZERO_GITHUB_OAUTH_REDIRECT_URI,
    pat: config.env.ZERO_GITHUB_TOKEN,
  });

  // -- OAuth: start ------------------------------------------------------
  createRoute(app, {
    path: "/v1/github/auth/start",
    method: "get",
    consumer: "github.auth.start",
    description: "Redirect to GitHub OAuth authorize URL",
  }, async (_parsed, req, res) => {
    if (!gh.configured) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "GitHub OAuth not configured", "GITHUB_OAUTH_UNCONFIGURED");
      return null;
    }
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : undefined;
    const state = getGithubStore().createOAuthState(redirect);
    const url = gh.buildAuthorizeUrl(state);
    res.redirect(url);
    return null;
  }, config);

  // -- OAuth: callback ---------------------------------------------------
  createRoute(app, {
    path: "/v1/github/auth/callback",
    method: "get",
    consumer: "github.auth.callback",
    description: "GitHub OAuth callback — exchanges code for token",
  }, async (_parsed, req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code) {
      sendError(res, HTTP.BAD_REQUEST, "missing OAuth code", "OAUTH_CODE_MISSING");
      return null;
    }
    const consumed = getGithubStore().consumeOAuthState(state);
    if (!consumed.ok) {
      sendError(res, HTTP.BAD_REQUEST, "invalid or expired OAuth state", "OAUTH_STATE_INVALID");
      return null;
    }
    try {
      const tokenResult = await gh.exchangeCodeForToken(code);
      const user = await gh.getUser(tokenResult.accessToken);
      getGithubStore().upsertAccount(user.login, {
        githubId: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        htmlUrl: user.htmlUrl,
        accessToken: tokenResult.accessToken,
        scope: tokenResult.scope,
        connectedAt: new Date().toISOString(),
      });
      const frontend = config.env.ZERO_FRONTEND_URL ?? "http://localhost:5173";
      const target = consumed.redirect ?? `${frontend}/github/connected`;
      res.redirect(`${target}?login=${encodeURIComponent(user.login)}&token=${encodeURIComponent(tokenResult.accessToken)}`);
      log.info("github account linked", { login: user.login });
      return null;
    } catch (err) {
      log.warn("github oauth callback failed", { error: extractErrorMessage(err) });
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(err), "OAUTH_EXCHANGE_FAILED");
      return null;
    }
  }, config);

  // -- Current user ------------------------------------------------------
  createRoute(app, {
    path: "/v1/github/me",
    method: "get",
    consumer: "github.me",
    description: "Get the linked GitHub account for the Bearer token",
  }, async (_parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    return {
      login: account.login,
      name: account.name,
      avatarUrl: account.avatarUrl,
      htmlUrl: account.htmlUrl,
      connectedAt: account.connectedAt,
    };
  }, config);

  // -- List repos --------------------------------------------------------
  createRoute(app, {
    path: "/v1/github/repos",
    method: "get",
    consumer: "github.repos",
    description: "List the authenticated user's GitHub repositories",
  }, async (_parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    try {
      const repos = await gh.listRepos(account.accessToken, { affiliation: "owner,collaborator" });
      return { repos };
    } catch (err) {
      sendError(res, HTTP.BAD_GATEWAY, extractErrorMessage(err), "GITHUB_API_ERROR");
      return null;
    }
  }, config);

  // -- Connect a repo to a task -----------------------------------------
  createRoute(app, {
    path: "/v1/github/connect",
    schema: connectRepoSchema,
    consumer: "github.connect",
    description: "Connect a GitHub repo (+issue) to a ZeroLance task",
    broadcast: "GithubRepoConnected",
  }, async (parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const ref = parseRepoRef(parsed.repo);
    if (!ref) {
      sendError(res, HTTP.BAD_REQUEST, "invalid repo (expected owner/repo or GitHub URL)", "BAD_REPO");
      return null;
    }
    try {
      const repo = await gh.getRepo(account.accessToken, ref.owner, ref.repo);
      getGithubStore().connectRepo({
        taskId: BigInt(parsed.taskId),
        owner: ref.owner,
        repo: ref.repo,
        issueNumber: parsed.issueNumber ? Number(parsed.issueNumber) : null,
        connectedBy: account.login,
        connectedAt: new Date().toISOString(),
        prNumber: null,
        prBranch: null,
      });
      log.info("repo connected", { taskId: String(parsed.taskId), repo: repo.fullName });
      return {
        taskId: String(parsed.taskId),
        repo: { owner: repo.owner, name: repo.name, fullName: repo.fullName, htmlUrl: repo.htmlUrl },
        issueNumber: parsed.issueNumber ? Number(parsed.issueNumber) : null,
        connectedBy: account.login,
      };
    } catch (err) {
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(safeGithubError(err)), "REPO_NOT_FOUND");
      return null;
    }
  }, config);

  // -- Get connection for a task ----------------------------------------
  createRoute(app, {
    path: "/v1/github/task/:id/repo",
    method: "get",
    consumer: "github.task.repo",
    description: "Get the GitHub repo linked to a task",
    requireId: true,
  }, async (_parsed, req, res) => {
    const conn = getGithubStore().getConnection(BigInt(req.params.id ?? "0"));
    if (!conn) {
      sendError(res, HTTP.NOT_FOUND, "no repo linked to this task", "NO_REPO_LINKED");
      return null;
    }
    return {
      taskId: conn.taskId.toString(),
      owner: conn.owner,
      repo: conn.repo,
      htmlUrl: repoUrl(conn.owner, conn.repo),
      issueNumber: conn.issueNumber,
      prNumber: conn.prNumber,
      prBranch: conn.prBranch,
      connectedBy: conn.connectedBy,
    };
  }, config);

  // -- Link a PR to a task ----------------------------------------------
  createRoute(app, {
    path: "/v1/github/task/:id/pr",
    schema: linkPrSchema,
    consumer: "github.task.linkPr",
    description: "Link a PR number to a task and verify it exists",
    requireId: true,
    broadcast: "GithubPrLinked",
  }, async (parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const taskId = BigInt(req.params.id ?? "0");
    const conn = getGithubStore().getConnection(taskId);
    if (!conn) {
      sendError(res, HTTP.NOT_FOUND, "no repo linked to this task", "NO_REPO_LINKED");
      return null;
    }
    try {
      const pr = await gh.getPullRequest(
        account.accessToken,
        conn.owner,
        conn.repo,
        Number(parsed.prNumber),
      );
      getGithubStore().setPr(taskId, pr.number, pr.headRef);
      return {
        taskId: taskId.toString(),
        prNumber: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged,
        headSha: pr.headSha,
        headRef: pr.headRef,
        htmlUrl: pr.htmlUrl,
      };
    } catch (err) {
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(safeGithubError(err)), "PR_NOT_FOUND");
      return null;
    }
  }, config);

  // -- Sync PR status + merge detection ---------------------------------
  createRoute(app, {
    path: "/v1/github/task/:id/sync",
    method: "get",
    consumer: "github.task.sync",
    description: "Fetch current PR status, CI checks, and merge state",
    requireId: true,
    broadcast: "GithubPrSynced",
  }, async (_parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const taskId = BigInt(req.params.id ?? "0");
    const conn = getGithubStore().getConnection(taskId);
    if (!conn) {
      sendError(res, HTTP.NOT_FOUND, "no repo linked to this task", "NO_REPO_LINKED");
      return null;
    }
    if (!conn.prNumber) {
      sendError(res, HTTP.BAD_REQUEST, "no PR linked to this task", "NO_PR_LINKED");
      return null;
    }
    try {
      const status = await gh.getPrStatus(
        account.accessToken,
        conn.owner,
        conn.repo,
        conn.prNumber,
      );
      const result = {
        taskId: taskId.toString(),
        owner: conn.owner,
        repo: conn.repo,
        prNumber: status.pr.number,
        title: status.pr.title,
        state: status.pr.state,
        merged: status.merged,
        mergedAt: status.pr.mergedAt,
        mergedBy: status.pr.mergedBy,
        headSha: status.pr.headSha,
        headRef: status.pr.headRef,
        baseRef: status.pr.baseRef,
        htmlUrl: status.pr.htmlUrl,
        checks: status.checks,
      };
      return result;
    } catch (err) {
      sendError(res, HTTP.BAD_GATEWAY, extractErrorMessage(safeGithubError(err)), "GITHUB_API_ERROR");
      return null;
    }
  }, config);

  // -- List issues for a repo -------------------------------------------
  createRoute(app, {
    path: "/v1/github/issues",
    method: "get",
    consumer: "github.issues.list",
    description: "List issues for a repo (query: ?owner=&repo=&state=open|closed|all)",
  }, async (_parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const owner = typeof req.query.owner === "string" ? req.query.owner : null;
    const repo = typeof req.query.repo === "string" ? req.query.repo : null;
    const state = typeof req.query.state === "string" ? req.query.state as "open" | "closed" | "all" : "open";
    if (!owner || !repo) {
      sendError(res, HTTP.BAD_REQUEST, "owner and repo query params required", "BAD_REQUEST");
      return null;
    }
    try {
      const issues = await gh.listIssues(account.accessToken, owner, repo, state);
      return { issues };
    } catch (err) {
      sendError(res, HTTP.BAD_GATEWAY, extractErrorMessage(safeGithubError(err)), "GITHUB_API_ERROR");
      return null;
    }
  }, config);

  // -- Create an issue in a repo ----------------------------------------
  createRoute(app, {
    path: "/v1/github/issues/create",
    schema: createIssueSchema,
    consumer: "github.issues.create",
    description: "Create a GitHub issue in a repo",
    broadcast: "GithubIssueCreated",
  }, async (parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const ref = parseRepoRef(parsed.repo);
    if (!ref) {
      sendError(res, HTTP.BAD_REQUEST, "invalid repo (expected owner/repo or GitHub URL)", "BAD_REPO");
      return null;
    }
    try {
      const issue = await gh.createIssue(account.accessToken, ref.owner, ref.repo, {
        title: parsed.title,
        body: parsed.body,
        labels: parsed.labels,
        assignees: parsed.assignees,
      });
      log.info("issue created", { owner: ref.owner, repo: ref.repo, number: issue.number });
      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        htmlUrl: issue.htmlUrl,
        repo: { owner: ref.owner, name: ref.repo },
        createdBy: account.login,
      };
    } catch (err) {
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(safeGithubError(err)), "ISSUE_CREATE_FAILED");
      return null;
    }
  }, config);

  // -- Get an issue ------------------------------------------------------
  createRoute(app, {
    path: "/v1/github/issues/get",
    method: "get",
    consumer: "github.issues.get",
    description: "Get a GitHub issue (query: ?owner=&repo=&number=)",
  }, async (_parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const owner = typeof req.query.owner === "string" ? req.query.owner : null;
    const repo = typeof req.query.repo === "string" ? req.query.repo : null;
    const numberStr = typeof req.query.number === "string" ? req.query.number : null;
    if (!owner || !repo || !numberStr) {
      sendError(res, HTTP.BAD_REQUEST, "owner, repo, and number query params required", "BAD_REQUEST");
      return null;
    }
    const issueNumber = Number(numberStr);
    if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
      sendError(res, HTTP.BAD_REQUEST, "number must be a positive integer", "BAD_REQUEST");
      return null;
    }
    try {
      const issue = await gh.getIssue(account.accessToken, owner, repo, issueNumber);
      return { issue };
    } catch (err) {
      sendError(res, HTTP.BAD_GATEWAY, extractErrorMessage(safeGithubError(err)), "GITHUB_API_ERROR");
      return null;
    }
  }, config);

  // -- Close / reopen an issue ------------------------------------------
  createRoute(app, {
    path: "/v1/github/issues/state",
    schema: updateIssueStateSchema,
    consumer: "github.issues.state",
    description: "Close or reopen a GitHub issue",
    broadcast: "GithubIssueStateChanged",
  }, async (parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const ref = parseRepoRef(parsed.repo);
    if (!ref) {
      sendError(res, HTTP.BAD_REQUEST, "invalid repo (expected owner/repo or GitHub URL)", "BAD_REPO");
      return null;
    }
    try {
      const issue = await gh.updateIssueState(
        account.accessToken,
        ref.owner,
        ref.repo,
        Number(parsed.number),
        parsed.state,
      );
      log.info("issue state updated", { owner: ref.owner, repo: ref.repo, number: issue.number, state: issue.state });
      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        htmlUrl: issue.htmlUrl,
        updatedBy: account.login,
      };
    } catch (err) {
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(safeGithubError(err)), "ISSUE_UPDATE_FAILED");
      return null;
    }
  }, config);

  // -- Create an issue for a connected task -----------------------------
  createRoute(app, {
    path: "/v1/github/task/:id/issue",
    schema: taskIssueSchema,
    consumer: "github.task.createIssue",
    description: "Create a GitHub issue for a task's connected repo",
    requireId: true,
    broadcast: "GithubIssueCreated",
  }, async (parsed, req, res) => {
    const account = resolveAccount(req, res, config);
    if (!account) return null;
    const taskId = BigInt(req.params.id ?? "0");
    const conn = getGithubStore().getConnection(taskId);
    if (!conn) {
      sendError(res, HTTP.NOT_FOUND, "no repo linked to this task", "NO_REPO_LINKED");
      return null;
    }
    try {
      const issue = await gh.createIssue(account.accessToken, conn.owner, conn.repo, {
        title: parsed.title,
        body: parsed.body,
        labels: parsed.labels,
        assignees: parsed.assignees,
      });
      // Auto-link the issue number to the existing connection
      getGithubStore().connectRepo({
        ...conn,
        issueNumber: issue.number,
      });
      log.info("task issue created", { taskId: taskId.toString(), repo: conn.repo, number: issue.number });
      return {
        taskId: taskId.toString(),
        number: issue.number,
        title: issue.title,
        state: issue.state,
        htmlUrl: issue.htmlUrl,
        repo: { owner: conn.owner, name: conn.repo },
        createdBy: account.login,
      };
    } catch (err) {
      sendError(res, HTTP.BAD_REQUEST, extractErrorMessage(safeGithubError(err)), "ISSUE_CREATE_FAILED");
      return null;
    }
  }, config);

  // -- Webhook receiver (push/pull_request) -----------------------------
  app.post("/v1/github/webhook", async (req: Request, res: Response) => {
    const secret = config.env.ZERO_GITHUB_WEBHOOK_SECRET;
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const event = req.headers["x-github-event"] as string | undefined;
    if (secret) {
      if (!signature || !verifyWebhookSignature(JSON.stringify(req.body), signature, secret)) {
        sendError(res, HTTP.UNAUTHORIZED, "invalid webhook signature", "WEBHOOK_SIGNATURE");
        return;
      }
    }
    if (event === "pull_request") {
      const body = req.body as {
        action?: string;
        pull_request?: { number?: number; head?: { ref?: string }; merged?: boolean };
        repository?: { owner?: { login?: string }; name?: string };
      };
      const pr = body.pull_request;
      const repoName = body.repository?.name;
      const owner = body.repository?.owner?.login;
      if (pr && owner && repoName) {
        broadcast("GithubPullRequest", {
          action: body.action,
          prNumber: pr.number,
          merged: pr.merged,
          owner,
          repo: repoName,
          headRef: pr.head?.ref,
        });
        log.info("webhook: pull_request", { action: body.action, pr: pr.number, merged: pr.merged });
      }
    }
    res.json({ received: true });
  });
}
