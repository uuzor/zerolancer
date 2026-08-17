import { isHex } from "viem";

import express, {
  type Request,
  type Response,
  type Express,
  type NextFunction,
} from "express";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { hexlify, isAddress, toBeHex } from "ethers";
import { HTTP } from "@zerolance/config";
import { ZodError } from "zod";
import { createApiKeyAuth } from "@zerolance/config/middleware/auth";

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  concatEncrypted,
  parseEncrypted,
} from "@zerolance/config/crypto/aes-gcm";
import {
  sealKeyForReceiver,
  unsealKeyForReceiver,
} from "@zerolance/config/crypto/keys";
import type { TeeSigner } from "./signer.js";
import type { StorageAdapter } from "@zerolance/config/storage/0g";
import type { OracleEnv } from "./env-schema.js";
import { verdictSignBodySchema, rekeyBodySchema, mintDataHashSchema } from "./route-schemas.js";

function logRouteError(route: string, err: unknown): void {
  console.log(
    JSON.stringify({
      level: "error",
      msg: `${route} error`,
      error: err instanceof Error ? err.message : String(err),
      route,
    }),
  );
}

function badRequest(res: Response, message: string): void {
  res.status(HTTP.BAD_REQUEST).json({ error: message });
}

/// Caps issued verdict validity so they cannot be valid far into the future.
const MAX_VERDICT_VALIDITY_SECONDS = 7n * 24n * 3600n;

export interface ServerConfig {
  signer: TeeSigner;
  storage: StorageAdapter;
  bind: string;
  port: number;
  env?: OracleEnv;
}

export function startServer(config: ServerConfig): {
  app: Express;
  httpServer: import("node:http").Server;
} {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: [
            "'self'",
            config.env?.ZERO_FRONTEND_URL ?? "http://localhost:5173",
          ],
        },
      },
    }),
  );
  app.use(
    cors({ origin: config.env?.ZERO_FRONTEND_URL ?? "http://localhost:5173" }),
  );
  const rateLimitMax = config.env?.ZERO_RATE_LIMIT_MAX ?? 100;
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createApiKeyAuth(
      config.env?.ZERO_API_KEY,
      ["/health"],
      config.env?.ZERO_DISABLE_AUTH === "true",
      config.env?.ZERO_CLIENT_API_KEY,
    ),
  );
  app.use(rateLimit({ windowMs: 60_000, max: rateLimitMax }));
  const { signer, storage } = config;

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      signer: signer.address,
      uncompressedPubkey: hexlify(signer.uncompressedPubkey),
      version: "0.1.0",
    });
  });

  /// Sign an AI verdict (EIP-712). The backend calls this after running the
  /// verification pipeline; the returned signature is submitted on-chain.
  app.post("/v1/verdict/sign", async (req: Request, res: Response) => {
    try {
      const parsed = verdictSignBodySchema.parse(req.body);
      const taskId = BigInt(parsed.taskId);
      const score = BigInt(parsed.score);
      const nonce =
        parsed.nonce ??
        (hexlify(randomBytes(32)) as `0x${string}`);
      const defaultValidUntil =
        BigInt(Math.floor(Date.now() / 1000)) + 86_400n; // 1 day
      let validUntil = defaultValidUntil;
      if (parsed.validUntil !== undefined) {
        const v = BigInt(String(parsed.validUntil));
        const max = BigInt(Math.floor(Date.now() / 1000)) + MAX_VERDICT_VALIDITY_SECONDS;
        validUntil = v > max ? max : v;
      }
      const signature = signer.signVerdict({
        taskId,
        deliverableHash: parsed.deliverableHash,
        passed: parsed.passed,
        score,
        nonce,
        validUntil,
      });
      res.json({
        signature,
        signer: signer.address,
        nonce,
        validUntil: validUntil.toString(),
      });
    } catch (err) {
      if (err instanceof ZodError) {
        res
          .status(HTTP.BAD_REQUEST)
          .json({ error: err.issues[0]?.message ?? "Validation error" });
        return;
      }
      logRouteError("/v1/verdict/sign", err);
      res.status(HTTP.INTERNAL).json({ error: "Verdict signing failed" });
    }
  });

  /// Re-key encrypted reputation metadata on NFT transfer (ERC-7857 flow).
  /// Mirrors axiom-protocol's /v1/transfer-validity: download → decrypt →
  /// re-encrypt → upload → seal key for receiver.
  app.post("/v1/transfer-validity", async (req: Request, res: Response) => {
    try {
      const parsed = rekeyBodySchema.parse(req.body);
      const { oldDataHash, oldDataUri, targetPubkey64, nonce, to, nft } = parsed;

      if (targetPubkey64.length !== 130) {
        return badRequest(res, "targetPubkey64 must be 64 bytes (128 hex chars)");
      }
      // Bind URI to claimed hash (storage root identity).
      const normHash = String(oldDataHash).toLowerCase().replace(/^0x/, "");
      const normUri = String(oldDataUri).toLowerCase().replace(/^0x/, "");
      if (normHash !== normUri) {
        return badRequest(res, "oldDataUri must equal oldDataHash (blob root binding)");
      }
      if (!to || !isAddress(to)) return badRequest(res, "'to' must be a valid address");
      if (!nft || !isAddress(nft)) return badRequest(res, "'nft' must be a valid address");

      const sealedDek = (req.body as { sealedDataEncryptionKey?: string })
        ?.sealedDataEncryptionKey;
      const allowCleartext =
        config.env?.ZERO_ALLOW_CLEARTEXT_DEK === "true" &&
        process.env.NODE_ENV !== "production";

      let oldDataKey: Buffer;
      if (typeof sealedDek === "string" && sealedDek.length > 0) {
        const sealedBytes = Buffer.from(
          sealedDek.startsWith("0x") ? sealedDek.slice(2) : sealedDek,
          sealedDek.startsWith("0x") ? "hex" : "base64",
        );
        oldDataKey = Buffer.from(
          unsealKeyForReceiver(signer.privateKeyBytes, new Uint8Array(sealedBytes)),
        );
      } else if (parsed.oldDataEncryptionKey && allowCleartext) {
        oldDataKey = Buffer.from(parsed.oldDataEncryptionKey, "base64");
      } else if (parsed.oldDataEncryptionKey && !allowCleartext) {
        return badRequest(
          res,
          "cleartext oldDataEncryptionKey rejected; send sealedDataEncryptionKey (ECIES to oracle pubkey from GET /health)",
        );
      } else {
        return badRequest(
          res,
          "sealedDataEncryptionKey is required (ECIES-seal the 32-byte DEK to oracle uncompressed pubkey)",
        );
      }
      if (oldDataKey.length !== 32) {
        return badRequest(res, "data encryption key must be 32 bytes after unseal");
      }

      const oldBlob = await storage.download(oldDataUri as `0x${string}`);
      const oldPlaintext = aesGcmDecrypt(oldDataKey, parseEncrypted(oldBlob));

      const newDataKey = new Uint8Array(randomBytes(32));
      const newBlob = concatEncrypted(aesGcmEncrypt(newDataKey, oldPlaintext));
      const { rootHash: newDataHash } = await storage.upload(newBlob);
      storage.markDataHashSeen(newDataHash);

      const targetPubkeyBytes = Buffer.from(
        (targetPubkey64 as string).replace(/^0x/, ""),
        "hex",
      );
      const sealedKey = sealKeyForReceiver(new Uint8Array(targetPubkeyBytes), newDataKey);

      // Sign the ERC-7857 OwnershipProof (EIP-712). The TEE attests that it
      // re-keyed the encrypted metadata blob and sealed the new DEK for the
      // receiver's targetPubkey. The proof references oldDataHash (the current
      // on-chain dataHash) so _proofCheck in ERC7857Upgradeable matches.
      const validUntil = BigInt(
        parsed.validUntil ?? Math.floor(Date.now() / 1000) + 3600,
      );
      const proofNonce = (parsed.nonce as `0x${string}`) ?? ("0x" + "00".repeat(32));

      const ownershipProof = signer.signOwnershipProof({
        dataHash: oldDataHash as `0x${string}`,
        sealedKey: hexlify(sealedKey) as `0x${string}`,
        targetPubkey: ("0x" + (targetPubkey64 as string).replace(/^0x/, "")) as `0x${string}`,
        to: to as `0x${string}`,
        nft: nft as `0x${string}`,
        nonce: proofNonce,
        validUntil,
      });

      res.json({
        newDataUri: newDataHash,
        newDataHash: newDataHash as `0x${string}`,
        sealedKey: hexlify(sealedKey) as `0x${string}`,
        nonce: toBeHex(BigInt(nonce ?? 0)) as `0x${string}`,
        ownershipProof,
        validUntil: toBeHex(validUntil) as `0x${string}`,
      });
    } catch (err) {
      logRouteError("/v1/transfer-validity", err);
      res.status(HTTP.INTERNAL).json({ error: "Transfer validity failed" });
    }
  });

  /// Mark a dataHash as seen (called before reputation mint so /v1/ownership-style
  /// flows trust the hash). Mirrors axiom's /v1/agents/mint.
  app.post("/v1/reputation/mint", (req: Request, res: Response) => {
    try {
      const { dataHash } = mintDataHashSchema.parse(req.body);
      if (!/^0x[0-9a-fA-F]{64}$/.test(dataHash)) {
        return badRequest(res, "dataHash must be 0x + 64 hex chars");
      }
      storage.markDataHashSeen(dataHash as `0x${string}`);
      res.json({ ok: true, dataHash, seen: true });
    } catch (err) {
      if (err instanceof ZodError) {
        res
          .status(HTTP.BAD_REQUEST)
          .json({ error: err.issues[0]?.message ?? "Validation error" });
        return;
      }
      throw err;
    }
  });

  Sentry.setupExpressErrorHandler(app);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({
        level: "error",
        msg: "unhandled middleware error",
        error: message,
        code: "INTERNAL_ERROR",
      }),
    );
    const safeMessage = message.length > 200 ? message.slice(0, 200) + "..." : message;
    res.status(HTTP.INTERNAL).json({ error: safeMessage, code: "INTERNAL_ERROR" });
  });

  const httpServer = app.listen(config.port, config.bind, () => {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "oracle listening",
        bind: config.bind,
        port: config.port,
      }),
    );
    console.log(
      JSON.stringify({ level: "info", msg: "TEE signer", address: signer.address }),
    );
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "SIMULATED TEE: runs in Node.js with cleartext private key. Not Intel TDX/SEV.",
      }),
    );
  });
  return { app, httpServer };
}

// Re-export isHex for consumers/tests.
export { isHex };
