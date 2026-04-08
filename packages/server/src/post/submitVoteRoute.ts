import { Router } from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import ZK_KYCABI from "../abi/ZK_KYC.json";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545"; // Use RPC_URL from .env if available
const ZK_KYC_ADDRESS = process.env.ZK_KYC_ADDRESS?.trim();

const PRIVATE_KEY = process.env.PRIVATE_KEY; // Load the private key from .env

if (!PRIVATE_KEY) {
  console.error("Private key not found in .env file.");
  process.exit(1); // Exit if no private key found
}

if (!ZK_KYC_ADDRESS) {
  console.error("ZK_KYC_ADDRESS not found in .env file.");
  process.exit(1);
}

const submitVoteRoute = Router();

// Route to accept a string
submitVoteRoute.post("/vote", async (req, res) => {
  console.log("Voting");

  const { proofBytes } = req.body;
  const { publicInputs } = req.body;

  // console.log(req.body);
  console.log(proofBytes);
  console.log(publicInputs);

  if (proofBytes) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const zkKYC = new ethers.Contract(ZK_KYC_ADDRESS, ZK_KYCABI.abi, wallet);

    // we can check the validity of the proof here, but for this demo I am skipping it
    const publicInputsArray = [
      publicInputs.root,
      publicInputs.nulifierHash,
      publicInputs.proposalId,
      publicInputs.voteType,
    ];

    console.log("PUBLIC INPUTS", publicInputsArray)

    try {
      await zkKYC.vote(proofBytes, publicInputsArray);
      res.json({ success: true });
    } catch (error: any) {
      const reason = error?.revert?.args?.[0]
        || error?.reason
        || "Vote transaction failed";
      console.error("Vote failed:", reason, error);
      res.json({ success: false, reason });
    }
  }
});

export default submitVoteRoute;
