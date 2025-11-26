import { Address, Hash, Hex } from "viem";

export interface CeloNetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts: {
    agentRegistry: Address;
    agentTreasury: Address;
    donationSplitter: Address;
    yieldAggregator: Address;
    masterTrading: Address;
    attendanceNFT: Address;
  };
  tokens: {
    cUSD: Address;
    cEUR: Address;
    cREAL: Address;
    CELO: Address;
  };
  defiProtocols: {
    moola: Address;
    ubeswap: Address;
    curve: Address;
  };
}

export interface AgentInfo {
  agentId: bigint;
  owner: Address;
  agentType: string;
  agentWallet: Address;
  dailyLimit: bigint;
  perTxLimit: bigint;
  dailySpent: bigint;
  isActive: boolean;
}

export interface Transaction {
  hash: Hash;
  from: Address;
  to: Address;
  value: bigint;
  gasUsed: bigint;
  gasPrice: bigint;
  timestamp: number;
  blockNumber: bigint;
}

export interface TokenTransfer {
  hash: Hash;
  from: Address;
  to: Address;
  token: Address;
  amount: bigint;
  timestamp: number;
  blockNumber: bigint;
}

export interface Event {
  address: Address;
  topics: Hex[];
  data: Hex;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
}

export interface BlockEvents {
  blockNumber: bigint;
  transactions: Transaction[];
  transfers: TokenTransfer[];
  contractEvents: Event[];
}

export interface AgentAction {
  id: string;
  agent: AgentInfo;
  actionType: string;
  amount: bigint;
  recipient: Address | null;
  timestamp: bigint;
  transactionHash: Hash;
}

export interface Donation {
  id: string;
  donor: Address;
  token: Address;
  amount: bigint;
  splits: DonationSplit[];
  timestamp: bigint;
  transactionHash: Hash;
}

export interface DonationSplit {
  id: string;
  donation: Donation;
  recipient: Address;
  amount: bigint;
}

export interface YieldPosition {
  id: string;
  agent: AgentInfo;
  protocol: string;
  token: Address;
  amount: bigint;
  shares: bigint;
  apy: number;
  lastUpdated: bigint;
}

export interface GovernanceVote {
  id: string;
  agent: AgentInfo;
  proposalId: bigint;
  support: boolean;
  rationaleURI: string;
  timestamp: bigint;
  transactionHash: Hash;
}

export interface Proposal {
  proposalId: bigint;
  title: string;
  description: string;
  startTime: bigint;
  endTime: bigint;
  executed: boolean;
  forVotes: bigint;
  againstVotes: bigint;
}

export interface TransactionRequest {
  from?: Address;
  to: Address;
  data: Hex;
  value?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  feeCurrency?: Address;
}

export interface SignedTransaction {
  hash: Hash;
  raw: Hex;
}

export interface TransactionReceipt {
  hash: Hash;
  blockNumber: bigint;
  blockHash: Hash;
  transactionIndex: number;
  from: Address;
  to: Address;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: "success" | "reverted";
  logs: Event[];
}

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  returnData: Hex;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  riskScore: number;
  gasEstimate: bigint;
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  totalCost: bigint;
  feeCurrency: Address;
}

export interface AgentMemory {
  agentId: bigint;
  observations: Observation[];
  actions: Action[];
  learnings: string[];
  lastRun: Date;
}

export interface Observation {
  timestamp: Date;
  type: string;
  data: any;
}

export interface Action {
  timestamp: Date;
  type: string;
  params: any;
  result: any;
  success: boolean;
}

export interface DecisionResponse {
  action: string;
  params: any;
  reasoning: string;
  confidence: number;
  triggeredBy: string[];
}

export interface AgentConfig {
  goal: string;
  constraints: string;
  executionMode: "auto" | "propose";
  spendingLimits: {
    daily: bigint;
    perTx: bigint;
  };
  whitelist: Address[];
  blacklist: Address[];
  permissions: string[];
}
