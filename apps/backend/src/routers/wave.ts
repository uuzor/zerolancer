import type { Router, Response } from "express";
import { keccak256, toHex } from "viem";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { waveStore } from "../wave/index.js";
import { HTTP, bigintReplacer } from "@zerolance/config";
import { sendError } from "../utils/response.js";

function bigintStringify(value: unknown): string {
  return JSON.stringify(value, bigintReplacer);
}

function verifierOf(cfg: ServerConfig, res: Response): NonNullable<ServerConfig["waveVerifierClient"]> | null {
  if (!cfg.waveVerifierClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "wave verifier not configured", "WAVE_NOT_CONFIGURED");
    return null;
  }
  return cfg.waveVerifierClient;
}

function escrowOf(cfg: ServerConfig, res: Response): NonNullable<ServerConfig["waveEscrowClient"]> | null {
  if (!cfg.waveEscrowClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "wave escrow not configured", "WAVE_NOT_CONFIGURED");
    return null;
  }
  return cfg.waveEscrowClient;
}

function ossOf(cfg: ServerConfig, res: Response): NonNullable<ServerConfig["ossWaveClient"]> | null {
  if (!cfg.ossWaveClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "oss wave not configured", "OSS_NOT_CONFIGURED");
    return null;
  }
  return cfg.ossWaveClient;
}

function buildathonOf(cfg: ServerConfig, res: Response): NonNullable<ServerConfig["buildathonWaveClient"]> | null {
  if (!cfg.buildathonWaveClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "buildathon wave not configured", "BUILDATHON_NOT_CONFIGURED");
    return null;
  }
  return cfg.buildathonWaveClient;
}

function repoHashOf(repoUrl: string): `0x${string}` {
  return keccak256(toHex(repoUrl));
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function registerWaveRoutes(app: Router, config: ServerConfig): void {
  // ── Program reads ───────────────────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program/:id",
    method: "get",
    requireId: true,
    consumer: "wave.program",
    description: "Read a Wave program",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const program = await v.programOf(BigInt(parseInt(_req.params.id!, 10)));
    return { program: bigintStringify(program) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/wave-count",
    method: "get",
    consumer: "wave.waveCount",
    description: "Read wave count for a program",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const count = await v.waveCount(programId);
    return { waveCount: count.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/current-open-wave",
    method: "get",
    consumer: "wave.currentOpenWave",
    description: "Read the current open wave id for a program",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = await v.currentOpenWave(programId);
    return { waveId: waveId.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/wave/:id",
    method: "get",
    requireId: true,
    consumer: "wave.wave",
    description: "Read a single wave by global id",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const waveId = BigInt(parseInt(_req.params.id!, 10));
    const data = await v.waveOf(waveId);
    return { wave: bigintStringify(data) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/meta",
    method: "get",
    consumer: "wave.programMeta",
    description: "Read aggregate pool/budget/points for a program+wave",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = BigInt(parseInt((_req.query.waveId as string) ?? "0", 10));
    const [remaining, budget, totalClaimable] = await Promise.all([
      v.remainingPool(programId),
      v.waveBudget(programId, waveId),
      v.totalClaimable(programId, waveId),
    ]);
    return {
      remainingPool: remaining.toString(),
      waveBudget: budget.toString(),
      waveTotalClaimable: totalClaimable.toString(),
    };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claimable",
    method: "get",
    consumer: "wave.claimable",
    description: "Read a claimant's share for a program+wave",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = BigInt(parseInt((_req.query.waveId as string) ?? "0", 10));
    const who = (_req.query.who as string) ?? config.signerAddress ?? "";
    if (!who) {
      sendError(res, HTTP.BAD_REQUEST, "who is required unless a signer is configured", "WHO_REQUIRED");
      return null;
    }
    const [share, claimed] = await Promise.all([
      v.claimableShare(programId, waveId, who as `0x${string}`),
      v.claimed(programId, waveId, who as `0x${string}`),
    ]);
    return { share: share.toString(), claimed };
  }, config);

  // ── Escrow pool reads ──────────────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program/:id/pool",
    method: "get",
    consumer: "wave.pool",
    description: "Read escrow pooled/distributed totals for a program",
  }, async (_p, _req, res) => {
    const e = escrowOf(config, res);
    if (!e) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const [pooled, distributed] = await Promise.all([
      e.pooledOf(programId),
      e.distributedOf(programId),
    ]);
    return { pooled: pooled.toString(), distributed: distributed.toString() };
  }, config);

  // ── Writes: program lifecycle ──────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program",
    method: "post",
    consumer: "wave.createProgram",
    description: "Create a new wave program (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const body = parsed as {
      token: string;
      genesisPool: string;
      numWaves?: number | string;
      buildWindow?: number | string;
      evalWindow?: number | string;
      complimentWindow?: number | string;
      budgetMethod?: number | string;
      feeBps: number | string;
      treasury: string;
      specHash?: string;
    };
    const result = await v.createWaveProgram({
      token: body.token as `0x${string}`,
      genesisPool: BigInt(body.genesisPool),
      numWaves: Number(body.numWaves ?? 1),
      buildWindow: Number(body.buildWindow ?? 0),
      evalWindow: Number(body.evalWindow ?? 0),
      complimentWindow: Number(body.complimentWindow ?? 0),
      budgetMethod: Number(body.budgetMethod ?? 0),
      feeBps: Number(body.feeBps),
      treasury: body.treasury as `0x${string}`,
      specHash: (body.specHash ?? ZERO_BYTES32) as `0x${string}`,
    });
    return { txHash: result.txHash, programId: result.programId.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/deposit",
    schema: z.object({ amount: z.string() }),
    consumer: "wave.depositPool",
    description: "Deposit funding into a wave program (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const amount = BigInt(parsed.amount);
    const tx = await v.depositPool(programId, amount);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/open-wave",
    consumer: "wave.openWave",
    description: "Open a new wave on a program (signer)",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.openWave(programId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/close-wave",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.closeWave",
    description: "Close a wave (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.closeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/close-evaluation",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.closeEvaluation",
    description: "Close evaluation phase for a wave (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.closeEvaluation(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/finalize",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.finalize",
    description: "Finalize a wave (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.finalizeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/close",
    method: "post",
    consumer: "wave.closeProgram",
    description: "Close a wave program after final wave (signer)",
  }, async (_p, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.closeProgram(programId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claim",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.claim",
    description: "Claim a wave payout for the caller (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.claim(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  // ── Writes: projects ────────────────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program/:id/project",
    method: "post",
    schema: z.object({
      waveId: z.coerce.bigint().nonnegative(),
      wallet: z.string().min(42),
      repoUrl: z.string().min(2),
      description: z.string().max(2000).optional(),
    }),
    consumer: "wave.createProject",
    description: "Register a project on a wave",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as {
      waveId: bigint;
      wallet: string;
      repoUrl: string;
      description?: string;
    };
    const tx = await v.registerProject({
      programId,
      waveId: body.waveId,
      wallet: body.wallet as `0x${string}`,
      repoUrl: body.repoUrl,
    });
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/project/:projectId/points",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.setProjectPoints",
    description: "Set points for a project (signer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const projectId = BigInt(parseInt(_req.params.projectId ?? "0", 10));
    const tx = await v.setProjectPoints(programId, projectId, parsed.points);
    return { txHash: tx };
  }, config);

  // ── Writes: awarder & awards ───────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program/:id/awarder",
    method: "post",
    schema: z.object({
      who: z.string().min(42),
      allowed: z.boolean(),
    }),
    consumer: "wave.grantAwarder",
    description: "Grant or revoke awarder role (signer/organizer)",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { who: string; allowed: boolean };
    const tx = await v.grantAwarder(programId, body.who as `0x${string}`, body.allowed);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/award",
    method: "post",
    schema: z.object({
      waveId: z.coerce.bigint(),
      contributor: z.string().min(42),
      points: z.coerce.bigint(),
      refHash: z.string().optional(),
      kind: z.enum(["base", "compliment", "community"]).default("base"),
    }),
    consumer: "wave.award",
    description: "Award base/compliment/community points to a contributor",
  }, async (parsed, _req, res) => {
    const v = verifierOf(config, res);
    if (!v) return null;
    const body = parsed as {
      waveId: bigint;
      contributor: string;
      points: bigint;
      refHash?: string;
      kind: "base" | "compliment" | "community";
    };
    const ref = (body.refHash ?? ZERO_BYTES32) as `0x${string}`;
    const tx =
      body.kind === "base"
        ? await v.awardBase(body.waveId, body.contributor as `0x${string}`, body.points, ref)
        : body.kind === "compliment"
          ? await v.awardCompliment(body.waveId, body.contributor as `0x${string}`, body.points, ref)
          : await v.awardCommunity(body.waveId, body.contributor as `0x${string}`, body.points, ref);
    return { txHash: tx };
  }, config);

  // ── OSS mode routes ────────────────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/oss/accept-repo",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      repoUrl: z.string().min(2),
      allowed: z.boolean(),
    }),
    consumer: "wave.oss.acceptRepo",
    description: "Accept a repo (keccak256(repoUrl) → repoHash) (signer)",
  }, async (parsed, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const body = parsed as { programId: bigint; repoUrl: string; allowed: boolean };
    const repoHash = repoHashOf(body.repoUrl);
    const tx = await o.acceptRepo(body.programId, repoHash, body.allowed);
    return { txHash: tx, repoHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      repoUrl: z.string().min(2),
      specHash: z.string().min(2),
      basePoints: z.coerce.bigint(),
      complexity: z.coerce.number().int().nonnegative().optional(),
    }),
    consumer: "wave.oss.createIssue",
    description: "Create an OSS issue (keccak256(repoUrl) → repoHash) (signer/maintainer)",
  }, async (parsed, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const body = parsed as {
      programId: bigint;
      repoUrl: string;
      specHash: string;
      basePoints: bigint;
      complexity?: number;
    };
    const repoHash = repoHashOf(body.repoUrl);
    const tx = await o.createIssue({
      programId: body.programId,
      repoHash,
      specHash: body.specHash as `0x${string}`,
      basePoints: body.basePoints,
      complexity: body.complexity ?? 0,
    });
    return { txHash: tx, repoHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id",
    method: "get",
    requireId: true,
    consumer: "wave.oss.issue",
    description: "Read an OSS issue",
  }, async (_p, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id!, 10));
    const issue = await o.issue(issueId);
    return { issue: bigintStringify(issue) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/points",
    method: "post",
    schema: z.object({ basePoints: z.coerce.bigint() }),
    consumer: "wave.oss.setIssuePoints",
    description: "Override base points for an OSS issue (signer/maintainer)",
  }, async (parsed, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { basePoints: bigint };
    const tx = await o.setIssuePoints(issueId, body.basePoints);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/claim",
    method: "post",
    consumer: "wave.oss.claimIssue",
    description: "Claim an OSS issue (signer/builder)",
  }, async (_p, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await o.claimIssue(issueId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/pr",
    method: "post",
    schema: z.object({
      deliverableHash: z.string().min(2),
      prNumber: z.coerce.number().int().nonnegative(),
    }),
    consumer: "wave.oss.submitPr",
    description: "Submit a PR for an OSS issue (signer/builder)",
  }, async (parsed, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { deliverableHash: string; prNumber: number };
    const tx = await o.submitPr(issueId, body.deliverableHash as `0x${string}`, body.prNumber);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/merge",
    method: "post",
    consumer: "wave.oss.confirmMerge",
    description: "Confirm merge of an OSS issue (signer/maintainer)",
  }, async (_p, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await o.confirmMerge(issueId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/compliment",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.oss.addCompliment",
    description: "Add compliment points to an OSS issue (signer/maintainer)",
  }, async (parsed, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await o.addCompliment(issueId, parsed.points);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/close",
    method: "post",
    consumer: "wave.oss.closeIssue",
    description: "Close an OSS issue (signer)",
  }, async (_p, _req, res) => {
    const o = ossOf(config, res);
    if (!o) return null;
    const issueId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await o.closeIssue(issueId);
    return { txHash: tx };
  }, config);

  // ── Buildathon mode routes ─────────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/buildathon/team",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      wallet: z.string().min(42),
      repoUrl: z.string().min(2),
    }),
    consumer: "wave.buildathon.registerTeam",
    description: "Register a buildathon team (signer)",
  }, async (parsed, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const body = parsed as { programId: bigint; wallet: string; repoUrl: string };
    const tx = await b.registerTeam(body.programId, body.wallet as `0x${string}`, body.repoUrl);
    return { txHash: tx, repoHash: repoHashOf(body.repoUrl) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/team/:id",
    method: "get",
    requireId: true,
    consumer: "wave.buildathon.team",
    description: "Read a buildathon team",
  }, async (_p, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const teamId = BigInt(parseInt(_req.params.id!, 10));
    const team = await b.team(teamId);
    return { team: bigintStringify(team) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      teamId: z.coerce.bigint(),
      contentHash: z.string().min(2),
      repoUrl: z.string().min(2),
    }),
    consumer: "wave.buildathon.submit",
    description: "Submit a buildathon entry (signer)",
  }, async (parsed, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const body = parsed as {
      programId: bigint;
      teamId: bigint;
      contentHash: string;
      repoUrl: string;
    };
    const tx = await b.submit({
      programId: body.programId,
      teamId: body.teamId,
      contentHash: body.contentHash as `0x${string}`,
      repoHash: repoHashOf(body.repoUrl),
    });
    return { txHash: tx, repoHash: repoHashOf(body.repoUrl) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id",
    method: "get",
    requireId: true,
    consumer: "wave.buildathon.submission",
    description: "Read a buildathon submission",
  }, async (_p, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const subId = BigInt(parseInt(_req.params.id!, 10));
    const submission = await b.submission(subId);
    return { submission: bigintStringify(submission) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id/points",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      points: z.coerce.bigint(),
    }),
    consumer: "wave.buildathon.setSubmissionPoints",
    description: "Award points to a buildathon submission (signer/awarder)",
  }, async (parsed, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const subId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { programId: bigint; points: bigint };
    const tx = await b.setSubmissionPoints(body.programId, subId, body.points);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id/vote",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      points: z.coerce.bigint(),
    }),
    consumer: "wave.buildathon.castVote",
    description: "Cast a community vote on a buildathon submission (signer)",
  }, async (parsed, _req, res) => {
    const b = buildathonOf(config, res);
    if (!b) return null;
    const subId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { programId: bigint; points: bigint };
    const tx = await b.castVote(body.programId, subId, body.points);
    return { txHash: tx };
  }, config);

  // ── DB-backed metadata & projects ────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/programs",
    method: "get",
    consumer: "wave.programs",
    description: "List all wave programs with DB metadata",
  }, async (_p, _req, res) => {
    const programs = waveStore.listPrograms();
    return { programs: programs.map((p) => ({ ...p, programId: p.programId })) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/projects",
    method: "get",
    consumer: "wave.projects",
    description: "List projects for a wave (query ?waveId=N or ?builder=addr)",
  }, async (_p, _req, res) => {
    const programId = _req.params.id ?? "";
    const waveId = _req.query.waveId as string | undefined;
    const builder = _req.query.builder as string | undefined;
    if (waveId) {
      const rows = waveStore.listProjectsByWave(programId, waveId);
      return { projects: rows.map((p) => ({ ...p, id: p.id })) };
    }
    if (builder) {
      const rows = waveStore.listProjectsByBuilder(builder);
      return { projects: rows.map((p) => ({ ...p, id: p.id })) };
    }
    return { projects: [] };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/builders",
    method: "get",
    consumer: "wave.builders",
    description: "List builders registered for a program",
  }, async (_p, _req, res) => {
    const programId = _req.params.id ?? "";
    const builders = waveStore.listBuilders(programId);
    return { builders };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/builder",
    method: "post",
    schema: z.object({
      address: z.string().min(42),
      name: z.string().max(200).optional(),
      bio: z.string().max(1000).optional(),
      repoUrl: z.string().url().optional(),
    }),
    consumer: "wave.createBuilder",
    description: "Register or update builder profile",
  }, async (parsed, _req, res) => {
    const programId = _req.params.id ?? "";
    const body = parsed as {
      address: string;
      name?: string;
      bio?: string;
      repoUrl?: string;
    };
    waveStore.upsertBuilder({
      address: body.address,
      programId,
      name: body.name ?? "",
      bio: body.bio ?? "",
      repoUrl: body.repoUrl ?? "",
      appliedAt: new Date().toISOString(),
    });
    return { ok: true };
  }, config);

  createRoute(app, {
    path: "/v1/wave/project/:id",
    method: "get",
    requireId: true,
    consumer: "wave.project",
    description: "Read a single wave project",
  }, async (_p, _req, res) => {
    const project = waveStore.getProject(_req.params.id!);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "project not found", "PROJECT_NOT_FOUND");
      return null;
    }
    return { project };
  }, config);

  createRoute(app, {
    path: "/v1/wave/project/:id/status",
    method: "patch",
    schema: z.object({ status: z.string().max(50) }),
    consumer: "wave.updateProjectStatus",
    description: "Update project status (awarded, rejected, etc.)",
  }, async (parsed, _req, res) => {
    const id = _req.params.id!;
    const body = parsed as { status: string };
    waveStore.updateProjectStatus(id, body.status);
    return { ok: true };
  }, config);
}
