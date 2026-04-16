import express from "express";
import cors from "cors"; // Import cors

// get methods
import statusRoute from "./get/statusRoute";
import resultsRoute from "./get/resultsRoute";
import merkleProofRoute from "./get/merkleProofRoute";

// post methods
import requestKYC_Route from "./post/requestKYC_Route";
import submitVoteRoute from "./post/submitVoteRoute";

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Enable CORS for all routes
// You can also customize CORS options if needed
app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.send("/zk-kyc api status nominal");
});

app.use(statusRoute);
app.use(resultsRoute);
app.use(merkleProofRoute);
app.use(requestKYC_Route);
app.use(submitVoteRoute);

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. If you are starting the whole workspace, use the root start script so stale workspace processes can be cleaned up automatically.`
    );
    process.exit(1);
  }

  throw error;
});
