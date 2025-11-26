
export { CeloClient } from "./celo-client";
export { BlockScanner } from "./event-monitor";
export { DecisionEngine } from "./decision-engine";
export { AgentEngine } from "./agent-engine";
export { AlchemyClient } from "./alchemy-client";
export { SecureTransactionManager } from "./secure-transaction-manager";
export { abiRegistry } from "./abi-registry";
export { chainHealthMonitor } from "./chain-health";
export { gasOptimizer } from "./gas-optimizer";

export * from "./functions";

export type {
  CeloNetworkConfig,
  AgentInfo,
  Transaction,
  TokenTransfer,
  Event,
  BlockEvents,
  TransactionRequest,
  TransactionReceipt,
  SimulationResult,
  ValidationResult,
  GasEstimate,
  AgentMemory,
  Observation,
  Action,
  AgentConfig,
  DecisionResponse,
  AgentAction,
  Donation,
  DonationSplit,
  YieldPosition,
  GovernanceVote,
  Proposal
} from "./types";

export type {
  AlchemyConfig,
  TransactionSecurityResult,
  NFTOperation,
  NFTMintResult
} from "./alchemy-client";

export type {
  SecureTransactionConfig,
  TransactionApproval
} from "./secure-transaction-manager";

export const ALFAJORES_CONFIG = {
  chainId: 44787,
  name: "Celo Alfajores",
  rpcUrl: "https://alfajores-forno.celo-testnet.org",
  explorerUrl: "https://alfajores.celoscan.io",
  contracts: {
    agentRegistry: "0x0000000000000000000000000000000000000000",
    agentTreasury: "0x0000000000000000000000000000000000000000",
    donationSplitter: "0x0000000000000000000000000000000000000000",
    yieldAggregator: "0x0000000000000000000000000000000000000000",
    masterTrading: "0x0000000000000000000000000000000000000000",
    attendanceNFT: "0x0000000000000000000000000000000000000000"
  },
  tokens: {
    cUSD: "0x874069Fa1Eb16D44d62F6a2e4c8B0C1C3b1C5C1C",
    cEUR: "0x10c892A6ECfc32b4C1C6Cb8C1C3b1C5C1C3b1C5C1C",
    cREAL: "0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC",
    CELO: "0x0000000000000000000000000000000000000000"
  },
  defiProtocols: {
    moola: "0x0000000000000000000000000000000000000000",
    ubeswap: "0x0000000000000000000000000000000000000000",
    curve: "0x0000000000000000000000000000000000000000"
  }
};

export const MAINNET_CONFIG = {
  chainId: 42220,
  name: "Celo Mainnet",
  rpcUrl: "https://forno.celo.org",
  explorerUrl: "https://celoscan.io",
  contracts: {
    agentRegistry: "0x0000000000000000000000000000000000000000",
    agentTreasury: "0x0000000000000000000000000000000000000000",
    donationSplitter: "0x0000000000000000000000000000000000000000",
    yieldAggregator: "0x0000000000000000000000000000000000000000",
    masterTrading: "0x0000000000000000000000000000000000000000",
    attendanceNFT: "0x0000000000000000000000000000000000000000"
  },
  tokens: {
    cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
    CELO: "0x0000000000000000000000000000000000000000"
  },
  defiProtocols: {
    moola: "0x0000000000000000000000000000000000000000",
    ubeswap: "0x0000000000000000000000000000000000000000",
    curve: "0x0000000000000000000000000000000000000000"
  }
};
