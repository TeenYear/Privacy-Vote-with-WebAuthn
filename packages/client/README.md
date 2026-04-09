# Privacy Vote Client

A React and TypeScript frontend application that provides the user interface for registration, authentication, and privacy-preserving voting.

## Overview

This is the user interface for the Privacy Vote system, integrating:
- 🔐 **WebAuthn Authentication** - Sign in with biometrics or security keys
- 👛 **Ethereum Wallet Integration** - Connect wallets via Web3Modal
- 📊 **Zero-Knowledge Voting** - Generate privacy-preserving proofs using Noir circuits
- 🔗 **Blockchain Interaction** - Communicate directly with smart contracts

## Quick Start

### Installation

```bash
cd packages/client
pnpm install
```

### Development Mode

```bash
pnpm start
```

The app runs at `http://localhost:3000`

### Production Build

```bash
pnpm build
```

Outputs an optimized build to the `build/` directory.

## Project Structure

```
src/
├── App.tsx                    # Root application component
├── App.css                    # Application styles
├── index.tsx                  # Application entry point
├── components/
│   ├── connectButton.tsx      # Wallet connection button
│   ├── mainForm.tsx           # User registration and KYC form
│   └── voteForm.tsx           # Vote submission form
├── utils/
│   ├── webAuthn.ts            # WebAuthn API integration
│   ├── getCircuit.ts          # Noir circuit loader
│   └── utils.ts               # General utility functions
├── circuit/
│   ├── src/
│   │   └── main.nr            # Noir circuit source code
│   ├── Nargo.toml             # Circuit configuration
│   └── target/
│       └── vote.json          # Compiled circuit artifact
├── abi/
│   └── ZK_KYC.json            # ABI for ZK_KYC.sol
└── public/
    ├── index.html             # HTML template
    └── manifest.json          # PWA manifest
```

## Key Components

### 1. App.tsx — Root Component

Integrates all components and manages application-level state.

**Key state:**
- `username` — Current user's name
- `isAuthenticated` — Whether the user is authenticated
- `isRoaming` — WebAuthn authenticator type
- `walletProvider` — Ethereum wallet provider

**Key usage:**
```typescript
// Connect to wallet provider
const { walletProvider } = useWeb3ModalProvider();

// Render KYC and vote forms
<MainForm {...props} />
<VoteForm username={username} />
```

### 2. ConnectButton.tsx — Wallet Connection

Provides Ethereum wallet connectivity via Web3Modal.

**Features:**
- Connect / disconnect wallet
- Display account address
- Handle network switching

**Configuration:**
```typescript
// Web3Modal project ID
const projectId = 'f970a14188f89386a9e004373a6da588';

// Supported networks
const chains = [
  {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
  },
  // ...
];
```

### 3. MainForm.tsx — User Authentication Form

Handles user registration and KYC requests.

**Workflow:**

```
Unauthenticated:
  ├─ Enter username
  └─ Click "Register to Vote"
      └─ Trigger WebAuthn registration
         └─ Save credentialId to localStorage

Authenticated:
  └─ Show "Request KYC" button
     └─ Click triggers WebAuthn authentication
        └─ Call server POST /request-kyc
           └─ User added to Merkle tree
              └─ Receive leaf index
```

**Key functions:**

```typescript
registerWithWebAuthn(username, isRoaming, setIsAuthenticated)
  // Steps:
  // 1. Generate credential ID
  // 2. Register via @passwordless-id/webauthn
  // 3. Save to localStorage
  // 4. Compute commitment and secret

loginWithWebAuthn(username, isRoaming, setIsAuthenticated)
  // Steps:
  // 1. Retrieve credentialId from localStorage
  // 2. Perform WebAuthn authentication
  // 3. Call POST /request-kyc
```

### 4. VoteForm.tsx — Vote Submission Form

Manages the voting flow and zero-knowledge proof generation.

**Key state:**
- `candidates` — List of 20 candidates (fetched from `/results`)
- `selectedIds` — Set of selected candidate IDs (max 1)
- `isSubmitting` — Submission in-progress flag
- `progress` — Proof generation progress

**Workflow:**

```typescript
const submitVotes = async () => {
  // 1. Verify user authentication
  const isAuthenticated = await authenticateUser(username);

  // 2. Generate a zero-knowledge proof for the selected candidate
  //    voteType = 1 (for, always 1)
  await generateProof(null, username, candidateId, 1);

  // 3. Refresh candidate vote counts after successful submission
  await fetchCandidates();
};
```

**UI layout:**
- Displays 20 candidates in a `SimpleGrid`
- Click a candidate card to toggle selection
- Maximum 1 candidate can be selected
- Shows a proof generation progress bar during submission

## Key Utility Functions

### webAuthn.ts

#### 1. `authenticateUser()`

```typescript
export const authenticateUser = async (username: string) => {
  const credentialId = window.localStorage.getItem(username);

  const res = await client.authenticate(
    [credentialId],
    window.crypto.randomUUID(),
    { authenticatorType: 'auto' }
  );

  return true; // or false on failure
};
```

Verifies the user's identity using WebAuthn.

#### 2. `generateProof()`

```typescript
export const generateProof = async (
  walletProvider: any,  // Reserved parameter, currently unused
  username: string,
  proposalId: number,
  voteType: number
) => {
  // 1. Use cached Noir + Barretenberg instances (initialized on first call, reused thereafter)
  const noir = await getNoirInstance();

  // 2. Fetch Merkle proof from the backend API (instead of reading the contract directly)
  const merkleRes = await fetch(`${API_URL}/merkle-proof/${leafIndex}`);
  const merkleData = await merkleRes.json();

  // 3. Construct proof inputs
  const inputs = {
    root: toHex(_root, { size: 32 }),
    nulifierHash: toHex(_nullifierHash, { size: 32 }),
    proofSiblings: [...],
    proofPathIndices: [...],
    nulifier: toHex(_nulifier, { size: 32 }),
    secret: toHex(_secret, { size: 32 }),
    proposalId: toHex(proposalId, { size: 32 }),
    voteType: toHex(voteType, { size: 32 })
  };

  // 4. Generate PLONK proof
  const proof = await noir.generateProof(inputs);

  // 5. Submit to server
  const apiResult = await pushUserVoteProofToAPI(proofInputs);

  return true;
};
```

**Caching mechanism:**

`getNoirInstance()` initializes the `BarretenbergBackend` and `Noir` instances on first call and returns the cached instances on subsequent calls, significantly speeding up proof generation.

**Parameter reference:**

| Parameter | Source | Description |
|-----------|--------|-------------|
| root | Backend `/merkle-proof` API | Current Merkle tree root |
| nulifierHash | poseidon2(nulifier, proposalId) | Double-vote prevention identifier |
| proofSiblings | Backend `/merkle-proof` API | Sibling nodes along the Merkle path |
| proofPathIndices | Backend `/merkle-proof` API | Path direction indicators |
| nulifier | localStorage | User secret |
| secret | localStorage | User secret |

#### 3. `fetchCandidates()`

```typescript
const fetchCandidates = async () => {
  const res = await fetch(`${API_URL}/results`);
  const data = await res.json();
  if (data.success) {
    setCandidates(data.candidates);
  }
};
```

**Response format:**
```typescript
{
  id: number;
  name: string;
  voteCount: number;
  votesFor: number;
}
```

### getCircuit.ts

Loads the pre-compiled Noir circuit or compiles it in the browser.

```typescript
export async function getCircuit(): Promise<CompiledCircuit> {
  // Use the pre-compiled circuit (recommended for production)
  return voteJson as CompiledCircuit;

  // Or compile dynamically in the browser (uncomment below)
  // const result = await compile(fm);
  // return result.program as CompiledCircuit;
}
```

**Performance notes:**
- Pre-compiled circuit is faster and recommended for production.
- In-browser compilation allows circuit updates without redeployment.

### utils.ts

```typescript
export const checkIsRegistered = (username: string): boolean => {
  return !!window.localStorage.getItem(username);
};
```

Checks whether a user is already registered locally.

## User Interaction Flow

### Complete Voting Workflow

```
1. Page Load
   ├─ Initialize Web3Modal
   ├─ Load Noir circuit
   └─ Show connect button

2. User Registration
   ├─ Enter username
   ├─ Click "Register to Vote"
   ├─ WebAuthn registration flow
   │  ├─ Generate credential
   │  └─ Save to localStorage
   ├─ Compute commitment = poseidon2(secret, nulifier)
   └─ Show login button

3. Authentication / KYC
   ├─ Click "Request KYC"
   ├─ WebAuthn authentication
   ├─ Server calls registerMultipleUsers()
   ├─ Receive leaf index in Merkle tree
   ├─ Save index to localStorage
   └─ Show vote form

4. Connect Wallet
   ├─ Click "Connect Wallet"
   ├─ Web3Modal opens
   └─ Confirm wallet connection

5. Generate Vote Proof
   ├─ Select 1 candidate from the list of 20
   ├─ Click "Submit Vote"
   ├─ Client generates Noir proof
   │  ├─ Fetch Merkle path from backend API
   │  ├─ Compute nullifierHash
   │  ├─ Generate proof using cached Barretenberg instance
   │  └─ Obtain PLONK proof and public inputs
   └─ Submit proof to server

6. On-Chain Voting
   ├─ Server verifies proof
   ├─ Calls zkKYC.vote()
   ├─ Smart contract verifies PLONK proof
   ├─ Checks nullifier has not been used
   ├─ Records vote
   └─ Display success message
```

## localStorage Data

The app persists the following data in the browser:

```javascript
// username -> credentialId
localStorage[username] = credentialId;

// username-secret -> secret data bundle
localStorage[`${username}-secret`] = JSON.stringify({
  secret: bigint,
  nulifier: bigint,
  leafIndex: number,
  commitment: bigint
});
```

> **Note:** This is demo-grade storage. Production deployments should use encrypted local storage.

## Configuration

### Environment Variables

Configure in `.env` or `public/config.js`:

```javascript
// Web3Modal project ID
const projectId = 'f970a14188f89386a9e004373a6da588';

// Smart contract address (auto-synced after deployment)
REACT_APP_ZK_KYC_ADDRESS=0x...   // set in .env.local
REACT_APP_API_URL=http://localhost:4000  // backend API URL
```

### Webpack Configuration

`webpack.config.js` includes:
- Source map support
- TypeScript compilation
- CSS processing
- HTML generation

## Dependencies

| Library | Purpose | Version |
|---------|---------|---------|
| react | UI framework | ^18.2.0 |
| ethers | Blockchain interaction | ^6.11.1 |
| @noir-lang/noir_js | Noir proof generation | ^0.25.0 |
| @noir-lang/backend_barretenberg | PLONK backend | ^0.25.0 |
| @passwordless-id/webauthn | WebAuthn API | ^1.5.0 |
| @web3modal/ethers | Wallet connection | ^4.1.5 |
| @chakra-ui/react | UI component library | ^2.8.2 |
| react-toastify | Toast notifications | ^10.0.5 |
| poseidon-lite | Poseidon hash | ^0.2.0 |

## Development Tips

### Debug Logging

Enable verbose logging in the browser console:

```javascript
// Inspect WebAuthn response
console.log('WebAuthn response:', res);

// Time proof generation
console.time('Proof Generation Time');
const proof = await noir.generateProof(inputs);
console.timeEnd('Proof Generation Time');

// Inspect contract interaction
const voteData = await getVoteData(walletProvider, proposalId);
console.log('Vote data:', voteData);
```

### Clear localStorage

```javascript
// Clear all user data
localStorage.clear();

// Clear a specific user
localStorage.removeItem('username');
localStorage.removeItem('username-secret');
```

### Client-Side Proof Verification

```typescript
// Verify a proof in the browser
const result = await noir.verifyProof(proof);
console.log('Verification result:', result);
```

## Troubleshooting

### Q: WebAuthn registration fails

**Possible causes:**
- Not running on HTTPS (localhost is exempt)
- Browser does not support WebAuthn
- Device lacks a fingerprint reader or security key

**Solutions:**
- Ensure the app runs on `localhost` or an HTTPS domain
- Use a modern browser (Chrome, Firefox, Safari, Edge)
- Try the "roaming authenticator" option

### Q: Proof generation is very slow

**Cause:**
- PLONK proof generation involves heavy cryptographic computation; single-threaded it can take 20–60 seconds.

**Solutions:**
- Multi-threading is already enabled in the code:
```typescript
const backend = new BarretenbergBackend(circuit, {
  threads: navigator.hardwareConcurrency
});
```
- Use a high-performance device.
- Pre-load the circuit to save time on first use.

### Q: Wallet fails to connect

**Checklist:**
- Is the wallet extension installed?
- Is the network correctly configured (localhost, chainId 31337)?
- Is the RPC endpoint reachable?

**Debug:**
```javascript
const { walletProvider } = useWeb3ModalProvider();
console.log('Wallet provider:', walletProvider);
```

### Q: Contract address is invalid

**Solution:**
1. Run the deployment script and check the address:
```bash
pnpm deploy:contracts
```
2. Copy the contract address from the output.
3. Update `WebAuthnAddress` in `connectButton.tsx`.

### Q: Vote fails with "User not found"

**Cause:**
- The user has not completed the KYC flow.
- The user's commitment is not in the Merkle tree.

**Solutions:**
1. Complete the full KYC flow.
2. Confirm the server successfully registered the user.
3. Check the `userData` mapping in the contract.

## Build & Deployment

### Production Build

```bash
pnpm build
```

Generates optimized static files in the `build/` directory, ready for any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS S3

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "start"]
```

## Performance Optimizations

1. **Lazy circuit loading** — Circuit resources are loaded on first use.
2. **Multi-threaded proving** — Leverages multiple CPU cores for faster proofs.
3. **Instance caching** — Avoids re-initializing the Barretenberg backend on every proof.
4. **Code splitting** — React optimizes bundle size automatically.

## Related Documentation

- [Main project README](../../README.md) — System architecture and full guide
- [Server README](../server/README.md) — Backend API documentation
- [ZKP README](../zkp/README.md) — Smart contracts and circuit details
- [Noir documentation](https://noir-lang.org/)
- [Web3Modal documentation](https://docs.walletconnect.com/web3modal/)

## License

ISC
