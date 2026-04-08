const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const addressFile = path.join(rootDir, 'packages', 'zkp', 'cache', 'zk_kyc_address.txt');
const deployBroadcastFile = path.join(
  rootDir,
  'packages',
  'zkp',
  'broadcast',
  'Deploy.s.sol',
  '31337',
  'run-latest.json',
);
const serverEnvFile = path.join(rootDir, 'packages', 'server', '.env');
const clientEnvFile = path.join(rootDir, 'packages', 'client', '.env.local');

function readAddress() {
  const address = fs.existsSync(addressFile)
    ? fs.readFileSync(addressFile, 'utf8').trim()
    : readAddressFromBroadcast();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid contract address in ${addressFile}: ${address}`);
  }

  if (!fs.existsSync(addressFile)) {
    fs.writeFileSync(addressFile, `${address}\n`, 'utf8');
  }

  return address;
}

function readAddressFromBroadcast() {
  const payload = JSON.parse(fs.readFileSync(deployBroadcastFile, 'utf8'));
  const zkKycDeployment = payload.transactions.find(
    (tx) => tx.contractName === 'ZK_KYC' && tx.contractAddress,
  );

  if (!zkKycDeployment) {
    throw new Error(`Could not find ZK_KYC deployment in ${deployBroadcastFile}`);
  }

  return zkKycDeployment.contractAddress;
}

function upsertEnvValue(filePath, updates) {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    : [];

  const remaining = new Map(Object.entries(updates));
  const nextLines = existing
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match) {
        return line;
      }

      const [, key] = match;
      if (!remaining.has(key)) {
        return `${key}=${match[2].trim()}`;
      }

      const value = remaining.get(key);
      remaining.delete(key);
      return `${key}=${value}`;
    });

  for (const [key, value] of remaining.entries()) {
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${nextLines.join('\n')}\n`, 'utf8');
}

function main() {
  const address = readAddress();

  upsertEnvValue(serverEnvFile, {
    RPC_URL: 'http://127.0.0.1:8545',
    ZK_KYC_ADDRESS: address,
  });

  upsertEnvValue(clientEnvFile, {
    REACT_APP_API_URL: 'http://localhost:4000',
    REACT_APP_ZK_KYC_ADDRESS: address,
  });

  console.log(`Synchronized ZK_KYC address: ${address}`);
}

main();