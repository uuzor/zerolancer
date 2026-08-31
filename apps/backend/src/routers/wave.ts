import type { Router, Response } from "express";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { WaveClient, waveStore } from "../wave/client.js";
import { HTTP, bigintReplacer } from "@zerolance/config";
import { sendError } from "../utils/response.js";

const idsSchema = z.object({
  programId: z.coerce.bigint().nonnegative(),
});
const waveIdsSchema = idsSchema.extend({
  waveId: z.coerce.bigint().nonnegative(),
});
const claimableSchema = waveIdsSchema.extend({
  who: z.string(),
});

function clientOf(cfg: ServerConfig, res: Response): WaveClient | null {
  if (!cfg.waveClient) {
    sendError(res, HTTP.SERVICE_UNAVAILABLE, "wave contracts not configured", "WAVE_NOT_CONFIGURED");
    return null;
  }
  return cfg.waveClient;
}

function bigintStringify(value: unknown): string {
  return JSON.stringify(value, bigintReplacer);
}

export function registerWaveRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/wave/program/:id",
    method: "get",
    requireId: true,
    consumer: "wave.program",
    description: "Read a Wave program",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const program = await wave.programOf(BigInt(parseInt(_req.params.id!, 10)));
    return { program: bigintStringify(program) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/wave/:waveId",
    method: "get",
    requireId: true,
    consumer: "wave.wave",
    description: "Read a single wave",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const waveId = BigInt(parseInt(_req.params.waveId ?? "0", 10));
    const data = await wave.waveOf(waveId);
    return { wave: bigintStringify(data) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/meta",
    method: "get",
    consumer: "wave.programMeta",
    description: "Read aggregate pool/budget/points for a program+wave",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = BigInt(parseInt((_req.query.waveId as string) ?? "0", 10));
    const [remaining, budget, totalClaimable, totalPoints] = await Promise.all([
      wave.remainingPool(programId),
      wave.waveBudget(programId, waveId),
      wave.totalClaimable(programId, waveId),
      wave.totalClaimable(programId, waveId),
    ]);
    return {
      remainingPool: remaining.toString(),
      waveBudget: budget.toString(),
      waveTotalClaimable: totalClaimable.toString(),
      waveTotalPoints: totalPoints.toString(),
    };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claimable",
    method: "get",
    consumer: "wave.claimable",
    description: "Read a claimant's share for a program+wave",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = BigInt(parseInt((_req.query.waveId as string) ?? "0", 10));
    const who = (_req.query.who as string) ?? config.signerAddress ?? "";
    if (!who) {
      sendError(res, HTTP.BAD_REQUEST, "who is required unless a signer is configured", "WHO_REQUIRED");
      return null;
    }
    const [share, claimed] = await Promise.all([
      wave.claimableShare(programId, waveId, who as `0x${string}`),
      wave.claimed(programId, waveId, who as `0x${string}`),
    ]);
    return { share: share.toString(), claimed };
  }, config);

  // ── Writes ---------------------------------------------------------------
  createRoute(app, {
    path: "/v1/wave/program/:id/deposit",
    schema: z.object({ amount: z.string() }),
    consumer: "wave.depositPool",
    description: "Deposit funding into a wave program (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const amount = BigInt(parsed.amount);
    const tx = await wave.depositPool(programId, amount);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/open-wave",
    consumer: "wave.openWave",
    description: "Open a new wave on a program (signer)",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.openWave(programId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/close-wave",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.closeWave",
    description: "Close a wave (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.closeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/open-evaluation",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.openEvaluation",
    description: "Open evaluation phase for a wave (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.openWave(programId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/close-evaluation",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.closeEvaluation",
    description: "Close evaluation phase for a wave (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.closeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/finalize",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.finalize",
    description: "Finalize a wave (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.finalizeWave(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/claim",
    method: "post",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.claim",
    description: "Claim a wave payout (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const who = _req.body?.who ?? config.signerAddress ?? "";
    if (!who) {
      sendError(res, HTTP.BAD_REQUEST, "who is required", "WHO_REQUIRED");
      return null;
    }
    const tx = await wave.claim(programId, parsed.waveId, who as `0x${string}`);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program",
    method: "post",
    consumer: "wave.createProgram",
    description: "Create a new wave program (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const body = parsed as {
      token: string;
      genesisPool: string;
      feeBps: string;
      treasury: string;
    };
    const result = await wave.createWaveProgram(
      body.token as `0x${string}`,
      BigInt(body.genesisPool),
      Number(body.feeBps),
      body.treasury as `0x${string}`,
    );
    waveStore.upsertProgram({
      programId: result.programId.toString(),
      organizer: "",
      token: body.token,
      genesisPool: body.genesisPool,
      numWaves: "0",
      buildWindow: "0",
      evalWindow: "0",
      complimentWindow: "0",
      budgetMethod: "0",
      feeBps: body.feeBps,
      treasury: body.treasury,
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { txHash: result.txHash, programId: result.programId.toString() };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/project",
    method: "post",
    schema: z.object({
      waveId: z.coerce.bigint().nonnegative(),
      builder: z.string().min(42),
      repoUrl: z.string().url(),
      repoHash: z.string().min(2),
      description: z.string().max(2000).optional(),
    }),
    consumer: "wave.createProject",
    description: "Register a project on a wave",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const body = parsed as {
      waveId: bigint;
      builder: string;
      repoUrl: string;
      repoHash: string;
      description?: string;
    };
    const tx = await wave.registerProject(
      programId,
      body.waveId,
      body.builder as `0x${string}`,
      body.repoHash as `0x${string}`,
    );
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/project/:id/points",
    method: "post",
    schema: z.object({ points: z.coerce.bigint() }),
    consumer: "wave.setProjectPoints",
    description: "Set points for a project (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const projectId = BigInt(parseInt(_req.params.id!, 10));
    const tx = await wave.setProjectPoints(projectId, parsed.points);
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
