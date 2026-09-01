import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import { verifySchema, submitVerdictSchema } from "../route-schemas.js";
import type { ServerConfig } from "../server.js";
import { broadcast } from "../ws/broadcaster.js";
import { HTTP } from "@zerolance/config";
import { sendError, extractErrorMessage } from "../utils/response.js";

export function registerVerificationRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/verification/verify",
    schema: verifySchema,
    consumer: "verification.verify",
    description: "Run AI-verified escrow pipeline (CI + AI scoring + oracle sign)",
  }, async (parsed, _req, res) => {
    const orchestrator = config.verdictOrchestrator;
    if (!orchestrator) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "verifier not configured", "VERIFIER_UNCONFIGURED");
      return null;
    }
    const result = await orchestrator.verify({
      taskId: BigInt(parsed.taskId),
      deliverableRef: parsed.deliverableRef,
      prNumber: parsed.prNumber !== undefined ? Number(parsed.prNumber) : undefined,
      repoUrl: parsed.repoUrl,
      coverageGateBps: parsed.coverageGateBps,
    });
    // Assemble the ready-to-submit on-chain Verdict struct so the client can
    // POST {verdict} directly to /v1/verification/submit without re-shaping.
    const verdict = {
      taskId: parsed.taskId.toString(),
      deliverableHash: result.verification.deliverableHash,
      passed: result.verification.passed,
      score: result.verification.score.toString(),
      nonce: result.nonce,
      validUntil: result.validUntil,
      signature: result.signature,
    };
    broadcast("VerdictSubmitted", {
      taskId: verdict.taskId,
      passed: verdict.passed,
      score: verdict.score,
      signer: result.signer,
    });
    return {
      verdict,
      verification: {
        taskId: result.verification.taskId.toString(),
        deliverableHash: result.verification.deliverableHash,
        passed: result.verification.passed,
        score: result.verification.score.toString(),
        reason: result.verification.reason,
        artifacts: result.verification.artifacts,
      },
      signer: result.signer,
    };
  }, config);

  createRoute(app, {
    path: "/v1/verification/submit",
    schema: submitVerdictSchema,
    consumer: "verification.submit",
    description: "Relay a signed verdict on-chain (permissionless submitVerdict)",
    requireServer: true,
    broadcast: "Released",
  }, async (parsed, _req, res) => {
    const client = config.escrowClient;
    if (!client || !client.signer) {
      sendError(res, HTTP.SERVICE_UNAVAILABLE, "escrow signer not configured", "ESCROW_SIGNER_UNCONFIGURED");
      return null;
    }
    try {
      // Convert string fields to bigint/Hex for the ethers tuple encoder.
      const verdict = {
        taskId: BigInt(parsed.verdict.taskId),
        deliverableHash: parsed.verdict.deliverableHash as `0x${string}`,
        passed: parsed.verdict.passed,
        score: BigInt(parsed.verdict.score),
        nonce: parsed.verdict.nonce as `0x${string}`,
        validUntil: BigInt(parsed.verdict.validUntil),
        signature: parsed.verdict.signature as `0x${string}`,
      };
      const txHash = await client.submitVerdict(verdict);
      return { txHash, taskId: verdict.taskId.toString() };
    } catch (err) {
      sendError(res, HTTP.INTERNAL, extractErrorMessage(err), "SUBMIT_VERDICT_FAILED");
      return null;
    }
  }, config);
}
