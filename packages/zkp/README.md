# Privacy Vote — ZKP (Zero Knowledge Proof) Layer

The zero-knowledge proof layer contains the Solidity smart contracts, Noir ZK circuits, and supporting tooling.

## Overview

This package implements the core on-chain logic of the privacy voting system:
- 🔐 **ZK_KYC.sol** — Main contract managing users, proposals, voting, and ZK proof verification
- 🌳 **CryptoTools.sol** — Cryptographic utilities implementing Merkle tree management
- 🔢 **Noir Circuit** — Zero-knowledge proof circuit that proves user eligibility without revealing identity
- ✅ **PLONK Verifier** — Auto-generated Solidity verifier contract

## Quick Start

### Prerequisites
- Foundry (Forge + Cast + Anvil)
- Noir compiler
- Rust toolchain

### Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Noir
curl -L https://install.aztec.network | bash
noirup
```

### Start a Local Blockchain

```bash
anvil -a 20  # Create 20 accounts
```

Default RPC: `http://127.0.0.1:8545`  
Chain ID: `31337`

### Deploy and Initialize

**Full first-time deployment:**

```bash
# 1. Deploy the main contract and verifier
forge script script/Deploy.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# 2. Batch-register test users (alice, bob, eve)
forge script script/BatchRegister.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# 3. Create voting proposals (candidates)
forge script script/SubmitProposal.s.sol \
  --fork-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### Compile and Test

**Compile Solidity contracts:**

```bash
forge build
```

**Run tests:**

```bash
# Run all tests
forge test

# Run a specific test contract
forge test --match-contract zkKYCTest
forge test --match-contract ZKPverify
```

## Project Structure

```
packages/zkp/
├── src/
│   ├── ZK_KYC.sol              # Main smart contract
│   ├── CryptoTools.sol         # Cryptographic utilities
│   └── libraries/
│       ├── plonk_vk.sol        # PLONK verifier (auto-generated)
│       ├── PoseidonT2.sol      # Poseidon2 hash function
│       ├── PoseidonT3.sol      # Poseidon3 hash function
│       ├── InternalBinaryIMT.sol # Internal binary Merkle tree
│       └── Constants.sol       # Constant definitions
├── circuits/
│   ├── src/
│   │   └── main.nr             # Noir circuit (core ZK proof logic)
│   ├── Nargo.toml              # Noir package configuration
│   ├── Prover.toml             # Prover configuration
│   ├── Verifier.toml           # Verifier configuration
│   ├── proofs/
│   │   └── vote.proof          # Example proof
│   └── target/
│       └── vote.json           # Compiled circuit artifact
├── data/                       # Test data files
│   ├── commitment.txt
│   ├── nulifier.txt
│   ├── secret.txt
│   ├── root.txt
│   └── ...
├── script/
│   ├── Deploy.s.sol            # Deployment script
│   ├── BatchRegister.s.sol     # Batch user registration script
│   ├── SubmitProposal.s.sol    # Proposal creation script
│   ├── RequestRegister.s.sol
│   ├── AuthenticateUser.s.sol
│   ├── GetValue.s.sol
│   └── ...
├── test/
│   ├── zkKYC.t.sol             # ZK_KYC contract tests
│   ├── zkVote.t.sol            # Vote functionality tests
│   └── utils/
│       ├── Bytes32toString.sol
│       └── formatOutput.rs     # Proof output formatter
└── foundry.toml                # Foundry configuration
```

## Smart Contract Reference

### ZK_KYC.sol — Main Contract

The core smart contract that manages users, proposals, voting, and ZK proof verification.

#### Key Data Structures

```solidity
struct UserInfo {
    address userAddress;      // User's wallet address
    string username;          // Username
    uint256 commitment;       // User commitment (hash of secret data)
    uint256 commitmentId;     // ID in the Merkle tree
    bool isAuthenticated;     // Whether the user has passed KYC
}

struct Proposal {
    string description;       // Proposal description
    uint256 voteCount;        // Total vote count
    uint256 votesFor;         // Votes in favour
    uint256 votesAgainst;     // Votes against
    uint256 createdAt;        // Creation timestamp
    bool isAccepted;          // Whether the proposal passed
    bytes data;               // Arbitrary extra data
}
```

#### Key Functions

**1. `requestRegistration()`**
```solidity
function requestRegistration(
    string memory username,
    uint256 commitment
) public
```
User requests registration by submitting their commitment (derived from `secret` and `nulifier`).

**2. `registerMultipleUsers()`**
```solidity
function registerMultipleUsers(
    string[] memory usernames,
    address[] memory userAddresses,
    uint256[] memory commitmentHashes
) external onlyAdmin
```
Admin batch-registers KYC-verified users.

- Adds entries to the `userData` mapping
- Inserts each commitment into the Merkle tree
- Returns the assigned leaf indices
- Emits the `UsersRegistered` event

**3. `createProof()`**
```solidity
function createProof(uint256 leafIndex)
    public
    view
    returns (ProofData memory)
```
Returns the Merkle proof path for a given leaf.

Returns:
- `proofSiblings` — 32 sibling nodes
- `proofPathIndices` — 32 path direction indicators

**4. `vote()`**
```solidity
function vote(
    bytes calldata proofBytes,
    uint256[] calldata publicInputs
) external
```
Submits a vote and verifies the PLONK proof.

Steps:
1. Verify the PLONK proof.
2. Check the nullifier has not been used.
3. Update vote counts.
4. Mark the nullifier as used.

**5. `createProposal()`**
```solidity
function createProposal(
    string memory description
) external onlyAdmin
```
Creates a new voting proposal (admin only).

#### Events

```solidity
event UsersRegistered(uint256[] leafIndices);              // Users registered
event ProposalCreated(uint256 proposalId);                 // Proposal created
event ProposalVoted(uint256 proposalId, uint256 voteType); // Vote submitted
event UserRegistered(string username);                     // Single user registered
```

### CryptoTools.sol — Cryptographic Utilities

Provides Merkle tree management and cryptographic helper functions.

#### Key Features

**1. Merkle tree insertion**
```solidity
function _insert(uint256 leaf)
    internal
    returns (uint256 root, uint256 index)
```
- 32-level binary Merkle tree
- Supports up to 2^32 users
- Maintains a history of 32 roots
- Uses Poseidon3 hashing

**2. Root validation**
```solidity
function isValidRoot(uint256 root)
    public
    view
    returns (bool)
```
Checks whether the provided root exists in the root history.

**3. Hashing**
```solidity
function hash(uint256 x, uint256 y)
    public
    pure
    returns (uint256)
```
Wrapper around the Poseidon hash function.

**4. Leaf verification**
```solidity
function verifyLeaf(
    uint256 leaf,
    uint256[] calldata proofSiblings,
    uint8[] calldata proofPathIndices
) public view returns (bool)
```
Verifies that a leaf and its Merkle proof are valid against the current root.

### InternalBinaryIMT.sol — Merkle Tree Implementation

Core implementation of the Binary Indexed Merkle Tree.

#### Data Structure

```solidity
struct BinaryIMTData {
    uint32 depth;                              // Tree depth
    uint256 _nextLeafIndex;                    // Next available leaf index
    mapping(uint32 => uint256[2][]) lastSubtrees; // Last subtrees per level
    mapping(uint32 => uint256) root;           // Root history
}
```

#### Key Operations

- `_init()` — Initialize the tree
- `_insert()` — Insert a new leaf
- `_getProof()` — Retrieve the Merkle proof path for a leaf
- Uses Poseidon3 for all hashing

## Noir Circuit Reference

### circuits/src/main.nr — Core ZK Circuit

Defines the zero-knowledge proof logic.

```noir
fn main(
    // Public inputs (visible on-chain)
    root: pub Field,                    // Merkle tree root
    nulifierHash: pub Field,            // Nullifier hash
    proposalId: pub Field,              // Proposal ID
    voteType: pub Field,                // Vote type (always 1 = for)

    // Private inputs (hidden from the chain)
    proofSiblings: [Field; 32],         // Sibling nodes along the Merkle path
    proofPathIndices: [Field; 32],      // Path directions (0 = left, 1 = right)
    nulifier: Field,                    // User secret
    secret: Field                       // User secret
)
```

#### Proof Logic

**Step 1: Verify the Merkle path from commitment to root**
```rust
let leaf = poseidon::bn254::hash_2([nulifier, secret]);

let mut hash: Field = leaf;

for i in 0..32 {
    if proofPathIndices[i] == 0 {
        hash = poseidon::bn254::hash_2([hash, proofSiblings[i]]);
    } else {
        hash = poseidon::bn254::hash_2([proofSiblings[i], hash]);
    }
}

assert(hash == root);  // Path must lead to the known root
```

**Step 2: Verify the nullifier hash**
```rust
assert(nulifierHash == poseidon::bn254::hash_2([nulifier, proposalId]));
```

This prevents double voting: each user produces a unique nullifier per proposal, so the same user cannot vote twice on the same proposal.

#### Compile the Circuit

```bash
cd circuits
nargo build
nargo check
```

This generates:
- Compiled circuit artifact (`target/vote.json`)
- Solidity verifier (`plonk_vk.sol`)

#### Generate and Verify Proofs (Offline Testing)

```bash
# Create a proof
nargo prove

# Verify a proof
nargo verify

# Generate the Solidity verifier
nargo codegen-verifier
```

## Deployment Scripts Reference

### Deploy.s.sol — Initial Deployment

```solidity
function run() public {
    vm.startBroadcast();

    // Deploy contracts
    ZK_KYC zkKYC = new ZK_KYC();
    UltraVerifier verifier = new UltraVerifier();

    console.log(address(zkKYC));

    // Link verifier to the main contract
    zkKYC.setVerifier(address(verifier));

    vm.stopBroadcast();
}
```

**What it does:**
- Deploys `ZK_KYC`
- Deploys the PLONK verifier
- Links the verifier to the main contract

### BatchRegister.s.sol — Batch Registration

```solidity
function run() public {
    vm.broadcast();

    ZK_KYC zkKYC = ZK_KYC(getZkKycAddress());

    // Register test users
    string[] memory usernames = ["alice", "bob", "eve"];
    address[] memory users = [...];
    uint256[] memory commitments = [...];

    zkKYC.registerMultipleUsers(usernames, users, commitments);
}
```

**Registered users:**
- `alice`: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- `bob`: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- `eve`: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### SubmitProposal.s.sol — Create Proposals

```solidity
function run() public {
    vm.startBroadcast();

    ZK_KYC zkKYC = ZK_KYC(getZkKycAddress());

    // Create 20 candidate proposals
    zkKYC.createProposal("Alice Morgan", "");
    zkKYC.createProposal("Bob Chen", "");
    zkKYC.createProposal("Carlos Rivera", "");
    // ... 20 candidates total

    vm.stopBroadcast();
}
```

**Candidates created:**
Alice Morgan, Bob Chen, Carlos Rivera, Diana Patel, Elena Volkov, Frank Osei, Grace Kim, Henry Zhang, Iris Nakamura, James Wilson, Keiko Tanaka, Liam Foster, Maria Santos, Noah Williams, Olivia Dubois, Patrick Murphy, Quinn Anderson, Rachel Cohen, Samuel Park, Tanya Sharma

## Testing

### Run Solidity Tests

```bash
# Run all tests
forge test

# Run a specific contract's tests
forge test --match-contract zkKYCTest

# Run a specific test function
forge test -k testMerkleProof

# Verbose output
forge test --match-contract zkKYCTest -vvv
```

### Test File Overview

**zkKYC.t.sol** — `ZK_KYC` contract tests
- User registration
- Merkle tree operations
- Data structure validation

**zkVote.t.sol** — Vote functionality tests
- PLONK proof verification
- Nullifier checks
- Vote count validation

**formatOutput.rs** — Proof output formatter
```bash
rustc test/utils/formatOutput.rs
./formatOutput < formatted_proof.json
```

## Core Cryptographic Design

### Merkle Tree Privacy

1. **User commitment**
   ```
   commitment = poseidon2(secret, nulifier)
   secret:   user private key material
   nulifier: user identity token
   ```

2. **On-chain anonymity**
   - Only commitments are stored, never user identities.
   - Multiple trees can grow independently.

3. **Proof path**
   - 32-level tree supports up to 2^32 users.
   - Path contains 32 sibling nodes.
   - Path indices encode left/right direction at each level.

### Nullifier — Preventing Double Voting

1. **Generation rule**
   ```
   nullifierHash = poseidon2(nulifier, proposalId)
   ```
   - Each user produces a unique nullifier per proposal.
   - The same user produces different nullifiers for different proposals.

2. **On-chain check**
   ```solidity
   mapping(uint256 => mapping(uint256 => bool)) nulifierHashes;
   // nulifierHashes[proposalId][nullifierHash]
   ```
   - Used nullifiers are recorded on-chain.
   - Prevents any double-vote attempt.

### Poseidon Hash

- **Poseidon2**: Used in client-side proof generation.
- **Poseidon3**: Used in the Merkle tree and smart contract.
- **Advantages:**
  - Optimised for ZK circuits
  - Low gas cost
  - Well-studied security properties

## Configuration

### foundry.toml

```toml
[profile.default]
solc_version = "0.8.13"
optimizer = true
optimizer_runs = 200

[dependencies]
forge-std = { git = "https://github.com/foundry-rs/forge-std", ... }
```

### Merkle Tree Parameters

```solidity
uint32 public constant ROOT_HISTORY_SIZE = 32;  // Keep 32 historical roots
uint32 public constant TREE_DEPTH = 32;           // Tree depth is 32 levels
```

## Common Tasks

### Verify a Deployed Contract

```bash
forge verify-contract --compiler-version v0.8.13 \
  <ADDRESS> ZK_KYC
```

### Query Contract State

```bash
# Get user info
cast call <CONTRACT> "userData(string)" "alice" \
  --rpc-url http://127.0.0.1:8545

# Get current Merkle root
cast call <CONTRACT> "getCurrentRoot()" \
  --rpc-url http://127.0.0.1:8545
```

### Send a Transaction

```bash
# Create a proposal
cast send <CONTRACT> "createProposal(string)" "Test Proposal" \
  --private-key <KEY> \
  --rpc-url http://127.0.0.1:8545
```

## Security Considerations

1. **Root history management**
   - 32 historical roots are kept to accommodate in-flight proofs.
   - Roots older than 32 insertions are considered invalid.

2. **Nullifier security**
   - Nullifiers are only visible on-chain once used.
   - It is computationally infeasible to recover the original commitment from a nullifier.

3. **Merkle tree integrity**
   - Uses the cryptographically secure Poseidon hash function.
   - 32 levels provide sufficient collision resistance.

4. **Access control**
   - The `onlyAdmin` modifier restricts sensitive operations.
   - `registerMultipleUsers` can only be called by the admin.

## Advanced Topics

### Customising the Circuit

Edit `circuits/src/main.nr` to change:
- Merkle tree depth
- Hash function
- Proof inputs

Recompile after changes:
```bash
nargo build
nargo codegen-verifier  # Generate an updated verifier
```

### Extending Proposal Functionality

`ZK_KYC.sol` can be extended to support:
- Voting deadlines
- Minimum quorum requirements
- Weighted voting
- Multiple-choice proposals

### Cross-Chain Deployment

To deploy to another EVM-compatible chain:
1. Configure the target network in `foundry.toml`.
2. Update `RPC_URL` and the private key.
3. Run the deployment script.

```bash
forge script script/Deploy.s.sol \
  --fork-url <OTHER_RPC> \
  --private-key <KEY> \
  --broadcast
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "User already exists" | Duplicate registration | Use a different username |
| "Merkle tree is full" | Tree at capacity | Increase tree depth or deploy a new tree |
| "Invalid proof" | Incorrect proof data | Check the proof generation parameters |
| "Nullifier already used" | User already voted | Vote on a different proposal |

## Related Resources

- [Foundry documentation](https://book.getfoundry.sh/)
- [Noir documentation](https://noir-lang.org/)
- [Poseidon hash function](https://www.poseidon-hash.info/)
- [PLONK proof system](https://eprint.iacr.org/2019/953)
- [OpenZeppelin contracts](https://docs.openzeppelin.com/)

