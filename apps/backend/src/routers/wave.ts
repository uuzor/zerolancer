import type { Router, Response } from "express";
import { z } from "zod";
import { createRoute } from "./route-factory.js";
import type { ServerConfig } from "../server.js";
import { WaveClient } from "../wave/client.js";
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
const writeWaveArgs = z.object({
  programId: z.coerce.bigint().nonnegative(),
  waveId: z.coerce.bigint().nonnegative().optional(),
  amount: z.string().optional(),
  repoHash: z.string().optional(),
  specHash: z.string().optional(),
  issueId: z.coerce.bigint().optional(),
  basePoints: z.coerce.bigint().optional(),
  complexity: z.coerce.bigint().optional(),
  deliverableHash: z.string().optional(),
  prNumber: z.coerce.bigint().optional(),
  team: z.string().optional(),
  teamId: z.coerce.bigint().optional(),
  contentHash: z.string().optional(),
  who: z.string().optional(),
  allowed: z.boolean().optional(),
  subId: z.coerce.bigint().optional(),
  points: z.coerce.bigint().optional(),
  weight: z.coerce.bigint().optional(),
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

/// Register Wave (Buildathon + Issue) REST endpoints backed by the WaveClient.
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
    path: "/v1/wave/program/:id/wave/:waveId",
    method: "get",
    consumer: "wave.wave",
    description: "Read a single wave within a program",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const waveId = BigInt(parseInt(_req.params.waveId ?? "0", 10));
    const data = await wave.waveOf(programId, waveId);
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
      wave.totalPoints(programId, waveId),
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

  createRoute(app, {
    path: "/v1/wave/issue/:id",
    method: "get",
    requireId: true,
    consumer: "wave.issue",
    description: "Read a Wave Issue",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const issue = await wave.issueOf(BigInt(parseInt(_req.params.id!, 10)));
    return { issue: bigintStringify(issue) };
  }, config);

  createRoute(app, {
    path: "/v1/wave/buildathon/submission/:id",
    method: "get",
    requireId: true,
    consumer: "wave.buildathon.submission",
    description: "Read a Wave Buildathon submission",
  }, async (_p, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const sub = await wave.submissionOf(BigInt(parseInt(_req.params.id!, 10)));
    return { submission: bigintStringify(sub) };
  }, config);

  // -- Writes ---------------------------------------------------------------
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
    path: "/v1/wave/program/:id/claim",
    schema: z.object({ waveId: z.coerce.bigint() }),
    consumer: "wave.claim",
    description: "Claim a wave payout (signer)",
  }, async (parsed, _req, res) => {
    const wave = clientOf(config, res);
    if (!wave) return null;
    const programId = BigInt(parseInt(_req.params.id ?? "0", 10));
    const tx = await wave.claim(programId, parsed.waveId);
    return { txHash: tx };
  }, config);

  createRoute(app, {
    path: "/v1/wave/program/:id/finalize",
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
}