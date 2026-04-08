import { Router } from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

import ZK_KYCABI from "../abi/ZK_KYC.json";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ZK_KYC_ADDRESS = process.env.ZK_KYC_ADDRESS?.trim();

const resultsRoute = Router();

resultsRoute.get("/results", async (req, res) => {
  try {
    if (!ZK_KYC_ADDRESS) {
      res.json({ success: false, message: "Contract address not configured" });
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ZK_KYC_ADDRESS, ZK_KYCABI.abi, provider);

    const totalProposals = await contract.currentProposalId();
    const candidates: {
      id: number;
      name: string;
      voteCount: number;
    }[] = [];

    for (let i = 0; i < Number(totalProposals); i++) {
      const proposal = await contract.proposals(i);
      candidates.push({
        id: i,
        name: proposal[0],       // description
        voteCount: Number(proposal[1]),
      });
    }

    // Ranked list sorted by voteCount descending
    const ranked = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

    res.json({
      success: true,
      totalCandidates: candidates.length,
      candidates,
      ranked,
    });
  } catch (error: any) {
    console.error("Failed to get results:", error);
    res.json({
      success: false,
      message: error?.message || "Failed to fetch results",
    });
  }
});

export default resultsRoute;
