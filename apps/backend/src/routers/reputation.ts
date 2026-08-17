import type { Router } from "express";
import { createRoute } from "./route-factory.js";
import { stakeSchema } from "../route-schemas.js";
import { z } from "zod";
import { bytes32Viem } from "@zerolance/config/types/hex";
import type { ServerConfig } from "../server.js";

const mintReputationSchema = z.object({
  dataDescription: z.string().min(1).max(256),
  dataHash: bytes32Viem,
});

export function registerReputationRoutes(app: Router, config: ServerConfig): void {
  createRoute(app, {
    path: "/v1/reputation/:id",
    method: "get",
    consumer: "reputation.task",
    description: "Get reputation NFTs minted for a task",
    requireId: true,
  }, async (_parsed, req) => {
    const taskId = BigInt(req.params.id ?? "0");
    const store = (await import("../events/store.js")).getEventStore();
    const events = store.queryByTask({
      taskId: taskId.toString(),
      eventName: "ReputationMinted",
    });
    return { taskId: taskId.toString(), nfts: events };
  }, config);

  createRoute(app, {
    path: "/v1/reputation/stake",
    schema: stakeSchema,
    consumer: "reputation.stake",
    description: "Stake $ZERO for a verified badge",
    broadcast: "VerifiedBadgeStaked",
  }, async (parsed, req) => {
    const tokenId = req.body.tokenId;
    if (tokenId === undefined) throw new Error("tokenId required in body");
    if (!config.addresses.reputationNft) throw new Error("reputation NFT not configured");
    const { TypedContract } = await import("@zerolance/config/types/contract");
    const { ZEROLANCE_REPUTATION_NFT_ABI } = await import("@zerolance/config");
    const rep = new TypedContract(
      config.addresses.reputationNft,
      [...ZEROLANCE_REPUTATION_NFT_ABI],
      null,
    );
    const calldata = rep.iface.encodeFunctionData("stakeVerifiedBadge", [BigInt(tokenId)]);
    return { calldata, to: config.addresses.reputationNft };
  }, config);

  createRoute(app, {
    path: "/v1/reputation/mint",
    schema: mintReputationSchema,
    consumer: "reputation.mint",
    description: "Mint a reputation NFT for a passed task (escrow forwards as MINTER_ROLE)",
    broadcast: "ReputationMinted",
  }, async (parsed, req) => {
    const taskId = req.body.taskId;
    if (taskId === undefined) throw new Error("taskId required in body");
    const escrow = config.escrowClient?.escrow;
    if (!escrow) throw new Error("escrow not configured");
    const calldata = escrow.iface.encodeFunctionData("mintReputationForTask", [
      BigInt(taskId),
      parsed.dataDescription,
      parsed.dataHash,
    ]);
    return { calldata, to: config.addresses.escrowVault };
  }, config);
}
