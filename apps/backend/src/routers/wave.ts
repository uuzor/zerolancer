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

function vaultOf(cfg: ServerConfig, res: Response): NonNullable<ServerConfig["waveVaultClient"]> | null {
  if (!cfg.waveVaultClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "wave vault not configured", "WAVE_NOT_CONFIGURED");
    return null;
  }
  return cfg.waveVaultClient;
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
    description: "Read a wave program",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
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
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const count = await v.waveCount(programId);
    return { waveCount: count.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/wave/:id",
    method: "get",
    requireId: true,
    consumer: "wave.wave",
    description: "Read a single wave by global id",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const waveId = BigInt(parseInt(_req.params.id!, 10));
    const data = await v.waveOf(waveId);
    return { wave: bigintStringify(data) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/meta",
    method: "get",
    consumer: "wave.programMeta",
    description: "Read aggregate pool/points for a program",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const [pooled, distributed] = await Promise.all([
      v.pooled(programId),
      v.distributed(programId),
    ]);
    return {
      pooled: pooled.toString(),
      distributed: distributed.toString(),
    };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claimable",
    method: "get",
    consumer: "wave.claimable",
    description: "Read a claimant's share for a wave",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const waveId = BigInt(parseInt((_req.query.waveId as string) ?? "0", 10));
    const who = (_req.query.who as string) ?? config.signerAddress ?? "";
    if (!who) {
      sendError(res, HTTP.BAD_REQUEST, "who is required unless a signer is configured", "WHO_REQUIRED");
      return null;
    }
    const share = await v.claimableShare(waveId, who as `0x${string}`);
    return { share: share.toString() };
  }, config);

  // ── Writes: program lifecycle ──────────────────────────────────────────
  createRoute(app, {
    path: "/v1/wave/program",
    method: "post",
    consumer: "wave.createProgram",
    description: "Create a new wave program (signer)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const body = parsed as {
      token: string;
      genesisPool: string;
      numWaves?: number | string;
      feeBps: number | string;
      treasury: string;
      specHash?: string;
    };
    const result = await v.createProgram({
      token: body.token as `0x${string}`,
      genesisPool: BigInt(body.genesisPool),
      numWaves: BigInt(body.numWaves ?? 1),
      feeBps: Number(body.feeBps),
      treasury: body.treasury as `0x${string}`,
      specHash: (body.specHash ?? ZERO_BYTES32) as `0x${string}`,
    });
    return { txHash: result.txHash, programId: result.programId.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/deposit",
    schema: z.object({ amount: z.string() }),
    consumer: "wave.deposit",
    description: "Deposit funding into a wave program (signer)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const amount = BigInt(parsed.amount);
    const tx = await v.deposit(programId, amount);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/open-wave",
    method: "post",
    consumer: "wave.openWave",
    description: "Open a new wave on a program (signer)",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
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
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.closeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/finalize",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.finalize",
    description: "Finalize a wave (signer)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await v.finalizeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claim",
    method: "post",
    schema: z.object({
      waveId: z.coerce.bigint(),
      builder: z.string().optional(),
    }),
    consumer: "wave.claim",
    description: "Claim a wave payout for a builder (signer or builder)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const body = parsed as { waveId: bigint; builder?: string };
    const builder = (body.builder ?? config.signerAddress) as `0x${string}`;
    if (!builder) {
      sendError(res, HTTP.BAD_REQUEST, "builder is required when no signer is configured", "BUILDER_REQUIRED");
      return null;
    }
    const tx = await v.claim(body.waveId, builder);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/award",
    method: "post",
    schema: z.object({
      waveId: z.coerce.bigint(),
      builder: z.string().min(42),
      points: z.coerce.bigint(),
    }),
    consumer: "wave.setPoints",
    description: "Set points for a builder in a wave (signer)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const body = parsed as { waveId: bigint; builder: string; points: bigint };
    const tx = await v.setPoints(body.waveId, body.builder as `0x${string}`, body.points);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/emergency-withdraw",
    method: "post",
    schema: z.object({
      to: z.string().min(42),
      amount: z.coerce.bigint(),
    }),
    consumer: "wave.emergencyWithdraw",
    description: "Emergency withdraw from a program (owner)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    if (!v) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as { to: string; amount: bigint };
    const tx = await v.emergencyWithdraw(programId, body.to as `0x${string}`, body.amount);
    return { txHash: tx };
  }, config);

  // ── OSS mode routes (DB-backed, optional on-chain points) ──────────────
  createRoute(app, {
    path: "/v1/wave/oss/accept-repo",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      repoUrl: z.string().min(2),
      allowed: z.boolean(),
    }),
    consumer: "wave.oss.acceptRepo",
    description: "Accept or reject a repo for OSS contributions (DB)",
  }, async (parsed, _req, res) => {
    const body = parsed as { programId: bigint; repoUrl: string; allowed: boolean };
    const repoHash = repoHashOf(body.repoUrl);
    waveStore.upsertProgram({
      programId: body.programId.toString(),
      organizer: "",
      token: "",
      genesisPool: "0",
      numWaves: "0",
      buildWindow: "0",
      evalWindow: "0",
      complimentWindow: "0",
      budgetMethod: "0",
      feeBps: "0",
      treasury: "",
      description: `oss-repo:${body.allowed ? "accepted" : "rejected"}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, repoHash };
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
    description: "Create an OSS issue (DB)",
  }, async (parsed, _req, res) => {
    const body = parsed as {
      programId: bigint;
      repoUrl: string;
      specHash: string;
      basePoints: bigint;
      complexity?: number;
    };
    const repoHash = repoHashOf(body.repoUrl);
    const issueId = crypto.randomUUID();
    waveStore.insertProject({
      id: issueId,
      programId: body.programId.toString(),
      waveId: "0",
      builder: "",
      team: "",
      repoUrl: body.repoUrl,
      repoHash,
      contentHash: body.specHash,
      description: `complexity:${body.complexity ?? 0}`,
      status: "open",
      pointsAwarded: body.basePoints.toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, issueId, repoHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/points",
    method: "post",
    schema: z.object({ basePoints: z.coerce.bigint() }),
    consumer: "wave.oss.setIssuePoints",
    description: "Override base points for an OSS issue (DB + optional on-chain)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    const issueId = _req.params.id!;
    const body = parsed as { basePoints: bigint };
    const project = waveStore.getProject(issueId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "issue not found", "ISSUE_NOT_FOUND");
      return null;
    }
    waveStore.updateProjectStatus(issueId, `points:${body.basePoints.toString()}`);
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      if (waveId > BigInt(0)) {
        txHash = await v.setPoints(waveId, project.builder as `0x${string}`, body.basePoints);
      }
    }
    return { ok: true, txHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/claim",
    method: "post",
    consumer: "wave.oss.claimIssue",
    description: "Claim an OSS issue (DB + optional on-chain)",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
    const issueId = _req.params.id!;
    const project = waveStore.getProject(issueId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "issue not found", "ISSUE_NOT_FOUND");
      return null;
    }
    waveStore.updateProjectStatus(issueId, "claimed");
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      if (waveId > BigInt(0) && project.builder) {
        txHash = await v.claim(waveId, project.builder as `0x${string}`);
      }
    }
    return { ok: true, txHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/pr",
    method: "post",
    schema: z.object({
      deliverableHash: z.string().min(2),
      prNumber: z.coerce.number().int().nonnegative(),
    }),
    consumer: "wave.oss.submitPr",
    description: "Submit a PR for an OSS issue (DB)",
  }, async (parsed, _req, res) => {
    const issueId = _req.params.id!;
    const body = parsed as { deliverableHash: string; prNumber: number };
    const project = waveStore.getProject(issueId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "issue not found", "ISSUE_NOT_FOUND");
      return null;
    }
    waveStore.updateProjectStatus(issueId, `pr:${body.prNumber}`);
    return { ok: true, prNumber: body.prNumber };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/merge",
    method: "post",
    consumer: "wave.oss.confirmMerge",
    description: "Confirm merge of an OSS issue (DB + optional on-chain points)",
  }, async (_p, _req, res) => {
    const v = vaultOf(config, res);
    const issueId = _req.params.id!;
    const project = waveStore.getProject(issueId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "issue not found", "ISSUE_NOT_FOUND");
      return null;
    }
    waveStore.updateProjectStatus(issueId, "merged");
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      const points = BigInt(project.pointsAwarded || "0");
      if (waveId > BigInt(0) && project.builder && points > BigInt(0)) {
        txHash = await v.setPoints(waveId, project.builder as `0x${string}`, points);
      }
    }
    return { ok: true, txHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/oss/issue/:id/compliment",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.oss.addCompliment",
    description: "Add compliment points to an OSS issue (DB + optional on-chain)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    const issueId = _req.params.id!;
    const body = parsed as { points: bigint };
    const project = waveStore.getProject(issueId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "issue not found", "ISSUE_NOT_FOUND");
      return null;
    }
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      if (waveId > BigInt(0) && project.builder) {
        txHash = await v.setPoints(waveId, project.builder as `0x${string}`, body.points);
      }
    }
    return { ok: true, txHash };
  }, config);

  // ── Buildathon mode routes (DB-backed, optional on-chain points) ────────
  createRoute(app, {
    path: "/v1/wave/buildathon/team",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      wallet: z.string().min(42),
      repoUrl: z.string().min(2),
    }),
    consumer: "wave.buildathon.registerTeam",
    description: "Register a buildathon team (DB)",
  }, async (parsed, _req, res) => {
    const body = parsed as { programId: bigint; wallet: string; repoUrl: string };
    const repoHash = repoHashOf(body.repoUrl);
    const teamId = crypto.randomUUID();
    waveStore.upsertBuilder({
      address: body.wallet,
      programId: body.programId.toString(),
      name: teamId,
      bio: "",
      repoUrl: body.repoUrl,
      appliedAt: new Date().toISOString(),
    });
    return { ok: true, teamId, repoHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission",
    method: "post",
    schema: z.object({
      programId: z.coerce.bigint(),
      teamId: z.string().min(1),
      contentHash: z.string().min(2),
      repoUrl: z.string().min(2),
    }),
    consumer: "wave.buildathon.submit",
    description: "Submit a buildathon entry (DB)",
  }, async (parsed, _req, res) => {
    const body = parsed as {
      programId: bigint;
      teamId: string;
      contentHash: string;
      repoUrl: string;
    };
    const repoHash = repoHashOf(body.repoUrl);
    const subId = crypto.randomUUID();
    waveStore.insertProject({
      id: subId,
      programId: body.programId.toString(),
      waveId: "0",
      builder: body.teamId,
      team: body.teamId,
      repoUrl: body.repoUrl,
      repoHash,
      contentHash: body.contentHash,
      description: "",
      status: "submitted",
      pointsAwarded: "0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, subId, repoHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id/points",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.buildathon.setSubmissionPoints",
    description: "Award points to a buildathon submission (DB + optional on-chain)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    const subId = _req.params.id!;
    const body = parsed as { points: bigint };
    const project = waveStore.getProject(subId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "submission not found", "SUBMISSION_NOT_FOUND");
      return null;
    }
    waveStore.updateProjectStatus(subId, `points:${body.points.toString()}`);
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      if (waveId > BigInt(0) && project.builder) {
        txHash = await v.setPoints(waveId, project.builder as `0x${string}`, body.points);
      }
    }
    return { ok: true, txHash };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id/vote",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.buildathon.castVote",
    description: "Cast a community vote on a buildathon submission (DB + optional on-chain)",
  }, async (parsed, _req, res) => {
    const v = vaultOf(config, res);
    const subId = _req.params.id!;
    const body = parsed as { points: bigint };
    const project = waveStore.getProject(subId);
    if (!project) {
      sendError(res, HTTP.NOT_FOUND, "submission not found", "SUBMISSION_NOT_FOUND");
      return null;
    }
    let txHash: string | undefined;
    if (v) {
      const waveId = BigInt(project.waveId || "0");
      if (waveId > BigInt(0) && project.builder) {
        txHash = await v.setPoints(waveId, project.builder as `0x${string}`, body.points);
      }
    }
    return { ok: true, txHash };
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
