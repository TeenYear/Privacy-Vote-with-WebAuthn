# Privacy Vote Server

Backend server responsible for handling KYC requests and vote submissions, and for interacting with the blockchain smart contract.

## Overview

This Node.js/Express server acts as the middleware layer for the Privacy Vote system. Its primary responsibilities are:
- Receiving KYC requests from the client
- Registering verified users on the blockchain
- Processing and submitting zero-knowledge vote proofs
- Interacting with the smart contract

## Directory Structure

```
src/
├── index.ts                 # Express server entry point
├── abi/
│   └── ZK_KYC.json          # ZK_KYC smart contract ABI
├── get/
│   ├── statusRoute.ts       # GET route — health check
│   ├── resultsRoute.ts      # GET route — candidate vote results
│   └── merkleProofRoute.ts  # GET route — Merkle proof proxy
├── post/
│   ├── requestKYC_Route.ts  # POST route — KYC request handler
│   └── submitVoteRoute.ts   # POST route — vote submission handler
└── circuit/
    └── vote.json            # Compiled Noir circuit output
```

## Installation

```bash
cd packages/server
pnpm install
```

## Environment Configuration

Create a `.env` file:

```env
# Blockchain RPC endpoint
RPC_URL=http://127.0.0.1:8545

# Private key used to sign transactions (Foundry Anvil account #0)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Server port
PORT=4000

# Smart contract address (auto-synced after deployment)
ZK_KYC_ADDRESS=0x...
```

> **Note on the default private key:** The key above corresponds to one of Foundry Anvil's default accounts. In production, use a secure key management system.

## Starting the Server

### Development mode
```bash
pnpm run dev
```

### Production mode
```bash
pnpm run build
pnpm run start
```

The server listens at `http://localhost:4000`.

## API Endpoints

### 1. Health Check

**GET** `/` or `/status`

Check API service status.

```bash
curl http://localhost:4000/status
```

**Response:**
```json
{
  "status": "ok",
  "sessionId": "1234567890-abc123",
  "blockNumber": 42,
  "contractAddress": "0x...",
  "merkleRoot": "12345..."
}
```

`sessionId` is a unique ID generated at server startup. The frontend can use it to detect server or chain restarts.

### 2. Query Candidate Vote Results

**GET** `/results`

Retrieve all candidates and their vote tallies.

```bash
curl http://localhost:4000/results
```

**Response:**
```json
{
  "success": true,
  "totalCandidates": 20,
  "candidates": [
    { "id": 0, "name": "Alice Morgan", "voteCount": 1, "votesFor": 1 },
    { "id": 1, "name": "Bob Chen", "voteCount": 0, "votesFor": 0 }
  ],
  "ranked": [
    { "id": 0, "name": "Alice Morgan", "voteCount": 1, "votesFor": 1 }
  ]
}
```

The `ranked` array is sorted by `votesFor` in descending order.

### 3. Get Merkle Proof

**GET** `/merkle-proof/:leafIndex`

Proxies a contract call to retrieve the Merkle proof path for a given leaf, avoiding direct Anvil RPC calls from the browser.

```bash
curl http://localhost:4000/merkle-proof/0
```

**Response:**
```json
{
  "success": true,
  "proofSiblings": ["12345...", "67890..."],
  "proofPathIndices": [0, 1, 0],
  "root": "98765..."
}
```

### 4. Request KYC Registration

**POST** `/request-kyc`

Submit a KYC request to register a user on the blockchain.

**Request body:**
```json
{
  "username": "alice",
  "userAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "commitmentHash": "0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864"
}
```

**Success response:**
```json
{
  "success": true,
  "leafIndices": ["0", "1", "2"]
}
```

**Error response:**
```json
{
  "success": false,
  "message": "Invalid user data"
}
```

**Workflow:**
1. Server receives the KYC request.
2. Calls `ZK_KYC.registerMultipleUsers()` to add the user to the Merkle tree.
3. Listens for the `UsersRegistered` event.
4. Returns the assigned leaf indices.
5. Client saves the indices for use in subsequent vote proof generation.

### 5. Submit Vote

**POST** `/vote`

Submit a zero-knowledge vote proof and record the vote on-chain.

**Request body:**
```json
{
  "proofBytes": "0x...",
  "publicInputs": {
    "root": "0x...",
    "nulifierHash": "0x...",
    "proposalId": "0",
    "voteType": "1"
  }
}
```

**Success response:**
```json
{
  "success": true
}
```

**Error response:**
```json
{
  "success": false
}
```

**Workflow:**
1. Server receives the vote proof.
2. Constructs the parameter array from the public inputs.
3. Calls `ZK_KYC.vote()` to submit the proof.
4. The smart contract verifies the proof and records the vote.
5. Returns success status to the client.

## Key Implementation Details

### requestKYC_Route.ts

```typescript
// Main steps:
// 1. Parse request body for commitmentHash
// 2. Connect to the RPC endpoint
// 3. Create a JSON-RPC provider using the private key
// 4. Instantiate the ZK_KYC contract
// 5. Call registerMultipleUsers()
// 6. Listen for the UsersRegistered event
// 7. Return the assigned leaf indices
```

### submitVoteRoute.ts

```typescript
// Main steps:
// 1. Extract proofBytes and publicInputs
// 2. Connect to the RPC endpoint
// 3. Instantiate the ZK_KYC contract
// 4. Construct the publicInputsArray
// 5. Call vote() to submit the proof
// 6. Contract verifies the PLONK proof
// 7. Return success status
```

## Smart Contract Interaction

### registerMultipleUsers

```solidity
function registerMultipleUsers(
    string[] memory usernames,
    address[] memory userAddresses,
    uint256[] memory commitmentHashes
) external onlyAdmin
```

**Behavior:**
- Batch-registers multiple users
- Generates a commitment for each user
- Inserts commitments into the Merkle tree
- Emits the `UsersRegistered` event
- Returns the array of assigned leaf indices

### vote

```solidity
function vote(
    bytes calldata proofBytes,
    uint256[] calldata publicInputs
) external
```

**Behavior:**
- Verifies the PLONK zero-knowledge proof
- Checks that the nullifier has not already been used
- Records the vote for the given proposal
- Emits the `ProposalVoted` event

## Error Handling

The server implements basic error handling:

- **Missing private key** — Fails immediately at startup with an error message.
- **Invalid RPC connection** — Returns `success: false` when a transaction fails.
- **Contract errors** — Exceptions are caught and reported.

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| ECONNREFUSED | RPC endpoint unavailable | Ensure Anvil is running on the correct port |
| Only owner can call | Not the admin account | Use the correct private key |
| User already exists | Duplicate username | Use a different username |
| Merkle tree is full | Tree capacity reached | Increase tree depth or deploy a new tree |

## CORS

The server enables CORS to allow requests from any origin:

```typescript
app.use(cors());
```

> **Production note:** Restrict allowed origins in production (see Security Considerations below).

## Security Considerations

### Production Recommendations

1. **Private key management**
   - Use a key management service (e.g., AWS Secrets Manager).
   - Never hard-code private keys in source code.

2. **Request validation**
   - Validate input formats and sizes.
   - Implement request signature verification.

3. **Rate limiting**
   - Prevent API abuse.
   - Limit requests per IP address.

4. **Logging and monitoring**
   - Log all transactions and errors.
   - Set up an alerting system.

5. **CORS hardening**
   - Restrict allowed origins instead of permitting all.

```typescript
// Example production CORS configuration
const corsOptions = {
  origin: ['https://yourdomain.com'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

## Development & Testing

### Testing with curl

```bash
# Health check
curl http://localhost:4000/

# KYC request
curl -X POST http://localhost:4000/request-kyc \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "userAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "commitmentHash": "0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864"
  }'

# Vote submission
curl -X POST http://localhost:4000/vote \
  -H "Content-Type: application/json" \
  -d '{
    "proofBytes": "0x...",
    "publicInputs": {
      "root": "0x...",
      "nulifierHash": "0x...",
      "proposalId": "0",
      "voteType": "1"
    }
  }'
```

### TypeScript Compilation

```bash
pnpm run build
```

Output is written to the `dist/` directory.

### Running the Compiled Output

```bash
node dist/index.js
```

## Dependencies

- **express** — Web framework
- **cors** — CORS middleware
- **ethers.js** — Ethereum interaction library
- **dotenv** — Environment variable management
- **typescript** — Type checking
- **ts-node** — Run TypeScript directly

## Frontend Integration

The frontend calls this server at the following endpoints:

```typescript
// In webAuthn.ts
const apiResult = await pushUserVoteProofToAPI(proofInputs);

// Request KYC
const response = await fetch('http://localhost:4000/request-kyc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, userAddress, commitmentHash })
});
```

## Local Network Configuration

| Setting | Value |
|---------|-------|
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Default contract address | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` (assigned at deploy time) |

## Troubleshooting

### Server fails to start
```
Error: Private key not found in .env file.
```
**Fix:** Ensure `PRIVATE_KEY` is set in your `.env` file.

### Cannot connect to RPC
```
Error: connect ECONNREFUSED 127.0.0.1:8545
```
**Fix:** Start Anvil:
```bash
pnpm start:zkp
```

### Transaction fails
```
Error: User already exists
```
**Fix:** Use a different username or reset the blockchain state.

### Contract address mismatch
Ensure the `ZK_KYC_ADDRESS` in `.env` matches the address from the latest deployment.

## Further Reading

- [Main project README](../../README.md) — Full system architecture
- [Client README](../client/README.md) — Frontend details
- [ZKP README](../zkp/README.md) — Smart contracts and circuits
