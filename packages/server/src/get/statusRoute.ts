import { Router } from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

import ZK_KYCABI from "../abi/ZK_KYC.json";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ZK_KYC_ADDRESS = process.env.ZK_KYC_ADDRESS?.trim();

const router = Router();

// A startup-unique ID so the frontend can detect server/chain restarts.
const SERVER_SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

router.get("/status", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const blockNumber = await provider.getBlockNumber();

    const result: Record<string, any> = {
      status: "ok",
      sessionId: SERVER_SESSION_ID,
      blockNumber,
      contractAddress: ZK_KYC_ADDRESS,
    };

    if (ZK_KYC_ADDRESS) {
      const contract = new ethers.Contract(ZK_KYC_ADDRESS, ZK_KYCABI.abi, provider);
      result.merkleRoot = (await contract.getCurrentRoot()).toString();
    }

    res.json(result);
  } catch (error) {
    res.json({ status: "ok", sessionId: SERVER_SESSION_ID });
  }
});

export default router;
