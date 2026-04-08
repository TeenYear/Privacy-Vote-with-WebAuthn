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

const requestKYC_Route = Router();

// Route to accept a string
requestKYC_Route.post("/request-kyc", async (req, res) => {
  console.log("data", req.body);
  const userData = req.body;

  console.log("request-kyc");

  if (userData) {
      const commitmentHash = userData.commitmentHash;

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const zkKYC = new ethers.Contract(ZK_KYC_ADDRESS, ZK_KYCABI.abi, wallet);

      try {
          const usernames = [userData.username];
          const userAddresses = [userData.userAddress];
          const commitmentHashes = [commitmentHash];

          // Create a promise that resolves when the event is fired
          const waitForEvent = new Promise<string[]>((resolve, reject) => {
            zkKYC.once("UsersRegistered", (indices: BigInt[]) => {
                console.log("Leaf Indices:", indices);
                // Convert each BigInt to a string
                const indicesStr = indices.map((index: BigInt) => index.toString());
                resolve(indicesStr); // Resolve the promise with the stringified indices
            });
        });
        

          const tx = await zkKYC.registerMultipleUsers(
              usernames,
              userAddresses,
              commitmentHashes,
          );

          await tx.wait(); // Wait for the transaction to be mined

          // Wait for the event to be captured
          const leafIndices = await waitForEvent;

          console.log("leafIndices", leafIndices);

          res.json({ success: true, leafIndices });

      } catch (error: any) {
          const reason = error?.revert?.args?.[0]
            || error?.reason
            || "Registration failed";
          console.error("KYC registration failed:", reason, error);
          res.json({ success: false, message: reason });
      }
  } else {
      res.json({ success: false, message: "Invalid user data" });
  }
});

export default requestKYC_Route;
