import { Router } from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

import ZK_KYCABI from "../abi/ZK_KYC.json";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ZK_KYC_ADDRESS = process.env.ZK_KYC_ADDRESS?.trim();

const merkleProofRoute = Router();

merkleProofRoute.get("/merkle-proof/:leafIndex", async (req, res) => {
  try {
    if (!ZK_KYC_ADDRESS) {
      res.json({ success: false, message: "Contract address not configured" });
      return;
    }

    const leafIndex = parseInt(req.params.leafIndex, 10);
    if (isNaN(leafIndex) || leafIndex < 0) {
      res.json({ success: false, message: "Invalid leaf index" });
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ZK_KYC_ADDRESS, ZK_KYCABI.abi, provider);

    const proofData = await contract.createProof(leafIndex);
    const root = await contract.getCurrentRoot();

    res.json({
      success: true,
      proofSiblings: proofData.proofSiblings.map((s: bigint) => s.toString()),
      proofPathIndices: proofData.proofPathIndices.map((i: bigint) => Number(i)),
      root: root.toString(),
    });
  } catch (error: any) {
    console.error("Failed to get merkle proof:", error);
    res.json({
      success: false,
      message: error?.revert?.args?.[0] || error?.reason || error?.message || "Failed to get merkle proof",
    });
  }
});

export default merkleProofRoute;
