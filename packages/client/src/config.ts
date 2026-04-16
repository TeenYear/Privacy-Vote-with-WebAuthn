const DEFAULT_API_URL = 'http://localhost:4000';

function requireEnv(name: 'REACT_APP_ZK_KYC_ADDRESS') {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Run the contract deployment sync step and restart the client.`);
  }
  return value;
}

export const ZK_KYC_ADDRESS = requireEnv('REACT_APP_ZK_KYC_ADDRESS');

export const API_URL = process.env.REACT_APP_API_URL || DEFAULT_API_URL;