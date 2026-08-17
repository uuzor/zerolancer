import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export interface GithubAccount {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  accessToken: string;
  scope: string;
  connectedAt: string;
}

export interface RepoConnection {
  taskId: bigint;
  owner: string;
  repo: string;
  issueNumber: number | null;
  connectedBy: string; // github login
  connectedAt: string;
  prNumber: number | null;
  prBranch: string | null;
}

const accounts = new Map<string, GithubAccount>();
const connections = new Map<string, RepoConnection>();
const oauthStates = new Map<string, { createdAt: number; redirect?: string }>();

const STATE_TTL_MS = 10 * 60 * 1000;

export class GithubStore {
  // -- OAuth state -------------------------------------------------------

  createOAuthState(redirect?: string): string {
    const state = randomBytes(16).toString("hex");
    oauthStates.set(state, { createdAt: Date.now(), redirect });
    return state;
  }

  consumeOAuthState(state: string): { ok: boolean; redirect?: string } {
    const entry = oauthStates.get(state);
    if (!entry) return { ok: false };
    oauthStates.delete(state);
    if (Date.now() - entry.createdAt > STATE_TTL_MS) return { ok: false };
    return { ok: true, redirect: entry.redirect };
  }

  // -- accounts (indexed by github login) --------------------------------

  upsertAccount(login: string, account: GithubAccount): void {
    accounts.set(login, account);
  }

  getAccount(login: string): GithubAccount | undefined {
    return accounts.get(login);
  }

  getAccountByToken(token: string): GithubAccount | undefined {
    for (const acct of accounts.values()) {
      if (timingSafeEqual(
        Buffer.from(acct.accessToken),
        Buffer.from(token),
      )) {
        return acct;
      }
    }
    return undefined;
  }

  // -- repo connections (indexed by taskId string) -----------------------

  connectRepo(conn: RepoConnection): void {
    connections.set(conn.taskId.toString(), conn);
  }

  getConnection(taskId: bigint): RepoConnection | undefined {
    return connections.get(taskId.toString());
  }

  setPr(taskId: bigint, prNumber: number, branch: string | null): RepoConnection | undefined {
    const conn = connections.get(taskId.toString());
    if (!conn) return undefined;
    conn.prNumber = prNumber;
    conn.prBranch = branch;
    return conn;
  }

  listConnections(): RepoConnection[] {
    return [...connections.values()];
  }

  removeConnection(taskId: bigint): boolean {
    return connections.delete(taskId.toString());
  }
}

let singleton: GithubStore | undefined;

export function getGithubStore(): GithubStore {
  if (!singleton) singleton = new GithubStore();
  return singleton;
}

/// Verify the X-Hub-Signature-256 header on incoming GitHub webhooks.
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signature.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}
