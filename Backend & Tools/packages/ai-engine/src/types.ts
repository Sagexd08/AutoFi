import { z } from 'zod';

// ============================================================================
// CHAIN DEFINITIONS
// ============================================================================

export const SupportedChainSchema = z.enum([
  'ethereum',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'avalanche',
  'bsc',
  'celo',
  'scroll',
  'zksync',
  'linea',
  'mantle',
]);

export type SupportedChain = z.infer<typeof SupportedChainSchema>;

export const ChainIdMap: Record<SupportedChain, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  bsc: 56,
  celo: 42220,
  scroll: 534352,
  zksync: 324,
  linea: 59144,
  mantle: 5000,
};

// ============================================================================
// FUNCTION REGISTRY SCHEMAS
// ============================================================================

export const ScheduleSchema = z.object({
  type: z.enum(['once', 'recurring']),
  cronExpression: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  timezone: z.string().optional().default('UTC'),
});

export const TransferFunctionSchema = z.object({
  function: z.literal('transfer'),
  params: z.object({
    token: z.string().describe('Token symbol or address'),
    amount: z.string().describe('Amount to transfer'),
    to: z.string().describe('Recipient address'),
    chain: SupportedChainSchema,
    schedule: ScheduleSchema.optional(),
  }),
});

export const SwapFunctionSchema = z.object({
  function: z.literal('swap'),
  params: z.object({
    tokenIn: z.string().describe('Token to swap from'),
    tokenOut: z.string().describe('Token to swap to'),
    amount: z.string().describe('Amount to swap'),
    slippage: z.number().min(0).max(100).default(0.5).describe('Slippage tolerance in percentage'),
    routePreference: z.enum(['fastest', 'cheapest', 'lowest_gas']).optional().default('cheapest'),
    chain: SupportedChainSchema,
  }),
});

export const AddLiquidityFunctionSchema = z.object({
  function: z.literal('addLiquidity'),
  params: z.object({
    pool: z.string().describe('Pool identifier or address'),
    amounts: z.array(z.object({
      token: z.string(),
      amount: z.string(),
    })).describe('Token amounts to add'),
    chain: SupportedChainSchema,
  }),
});

export const RemoveLiquidityFunctionSchema = z.object({
  function: z.literal('removeLiquidity'),
  params: z.object({
    pool: z.string().describe('Pool identifier or address'),
    percentage: z.number().min(0).max(100).describe('Percentage of LP to remove'),
    chain: SupportedChainSchema,
  }),
});

export const StakeFunctionSchema = z.object({
  function: z.literal('stake'),
  params: z.object({
    token: z.string().describe('Token to stake'),
    amount: z.string().describe('Amount to stake'),
    protocol: z.string().describe('Staking protocol'),
    chain: SupportedChainSchema,
  }),
});

export const UnstakeFunctionSchema = z.object({
  function: z.literal('unstake'),
  params: z.object({
    token: z.string().describe('Token to unstake'),
    amount: z.string().describe('Amount to unstake'),
    protocol: z.string().describe('Staking protocol'),
    chain: SupportedChainSchema,
  }),
});

export const ClaimRewardsFunctionSchema = z.object({
  function: z.literal('claimRewards'),
  params: z.object({
    protocol: z.string().describe('Protocol to claim from'),
    chain: SupportedChainSchema,
  }),
});

export const DepositVaultFunctionSchema = z.object({
  function: z.literal('deposit'),
  params: z.object({
    vault: z.string().describe('Vault identifier or address'),
    amount: z.string().describe('Amount to deposit'),
    chain: SupportedChainSchema,
  }),
});

export const WithdrawVaultFunctionSchema = z.object({
  function: z.literal('withdraw'),
  params: z.object({
    vault: z.string().describe('Vault identifier or address'),
    amount: z.string().describe('Amount to withdraw'),
    chain: SupportedChainSchema,
  }),
});

export const CreateStreamFunctionSchema = z.object({
  function: z.literal('createStream'),
  params: z.object({
    recipient: z.string().describe('Stream recipient address'),
    amountPerSecond: z.string().describe('Amount streamed per second'),
    token: z.string().describe('Token to stream'),
    chain: SupportedChainSchema,
    duration: z.number().optional().describe('Duration in seconds'),
  }),
});

export const DeployContractFunctionSchema = z.object({
  function: z.literal('deployContract'),
  params: z.object({
    type: z.enum(['erc20', 'erc721', 'erc1155', 'multisig', 'vesting', 'custom']),
    contractParams: z.record(z.unknown()).describe('Contract-specific parameters'),
    chain: SupportedChainSchema,
  }),
});

export const VoteFunctionSchema = z.object({
  function: z.literal('vote'),
  params: z.object({
    proposalId: z.string().describe('Proposal ID'),
    choice: z.union([z.number(), z.string()]).describe('Vote choice'),
    dao: z.string().describe('DAO identifier'),
    chain: SupportedChainSchema,
  }),
});

export const DelegateFunctionSchema = z.object({
  function: z.literal('delegate'),
  params: z.object({
    votingPowerTo: z.string().describe('Address to delegate to'),
    dao: z.string().describe('DAO identifier'),
    chain: SupportedChainSchema,
  }),
});

export const MulticallFunctionSchema = z.object({
  function: z.literal('executeMulticall'),
  params: z.object({
    calls: z.array(z.object({
      target: z.string(),
      callData: z.string(),
      value: z.string().optional(),
    })),
    chain: SupportedChainSchema,
  }),
});

export const AutoRebalanceFunctionSchema = z.object({
  function: z.literal('setAutoRebalance'),
  params: z.object({
    conditions: z.array(z.object({
      type: z.enum(['price_change', 'time_interval', 'balance_threshold']),
      value: z.union([z.string(), z.number()]),
      comparison: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']).optional(),
    })),
    targetAllocations: z.array(z.object({
      token: z.string(),
      percentage: z.number().min(0).max(100),
    })),
    chains: z.array(SupportedChainSchema),
  }),
});

export const RecurringPaymentFunctionSchema = z.object({
  function: z.literal('setRecurringPayment'),
  params: z.object({
    recipient: z.string().describe('Payment recipient'),
    amount: z.string().describe('Payment amount'),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
    token: z.string().describe('Payment token'),
    chain: SupportedChainSchema,
  }),
});

export const HedgePositionFunctionSchema = z.object({
  function: z.literal('hedgePosition'),
  params: z.object({
    strategy: z.enum(['short', 'put_options', 'stablecoin_conversion', 'diversify']),
    triggerConditions: z.array(z.object({
      metric: z.enum(['price_drop', 'volatility', 'liquidation_risk']),
      threshold: z.number(),
      timeframe: z.string().optional(),
    })),
    hedgePercentage: z.number().min(0).max(100),
    chain: SupportedChainSchema,
  }),
});

// Union of all function schemas
export const FunctionCallSchema = z.discriminatedUnion('function', [
  TransferFunctionSchema,
  SwapFunctionSchema,
  AddLiquidityFunctionSchema,
  RemoveLiquidityFunctionSchema,
  StakeFunctionSchema,
  UnstakeFunctionSchema,
  ClaimRewardsFunctionSchema,
  DepositVaultFunctionSchema,
  WithdrawVaultFunctionSchema,
  CreateStreamFunctionSchema,
  DeployContractFunctionSchema,
  VoteFunctionSchema,
  DelegateFunctionSchema,
  MulticallFunctionSchema,
  AutoRebalanceFunctionSchema,
  RecurringPaymentFunctionSchema,
  HedgePositionFunctionSchema,
]);

export type FunctionCall = z.infer<typeof FunctionCallSchema>;

// ============================================================================
// PARSED INTENT SCHEMA
// ============================================================================

export const ParsedIntentSchema = z.object({
  // Original user input
  originalPrompt: z.string(),
  
  // Confidence score 0-1
  confidence: z.number().min(0).max(1),
  
  // Identified intent type
  intentType: z.enum([
    'single_action',
    'multi_step',
    'recurring',
    'conditional',
    'query',
    'unclear',
  ]),
  
  // Parsed function calls (steps)
  steps: z.array(FunctionCallSchema),
  
  // Cross-chain routing if needed
  routing: z.object({
    requiresBridge: z.boolean(),
    bridgeSteps: z.array(z.object({
      fromChain: SupportedChainSchema,
      toChain: SupportedChainSchema,
      token: z.string(),
      amount: z.string(),
    })).optional(),
  }).optional(),
  
  // Scheduling/trigger information
  schedule: ScheduleSchema.optional(),
  
  // Conditions for execution
  conditions: z.array(z.object({
    type: z.enum(['price', 'time', 'balance', 'gas_price', 'custom']),
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  
  // Extracted entities
  entities: z.object({
    tokens: z.array(z.string()).optional(),
    addresses: z.array(z.string()).optional(),
    amounts: z.array(z.string()).optional(),
    chains: z.array(SupportedChainSchema).optional(),
    protocols: z.array(z.string()).optional(),
  }).optional(),
  
  // Warnings or clarifications needed
  warnings: z.array(z.string()).optional(),
  
  // Suggested clarifications if intent is unclear
  clarificationNeeded: z.array(z.string()).optional(),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ============================================================================
// PLAN SCHEMA
// ============================================================================

export const PlanStatusSchema = z.enum([
  'draft',
  'simulating',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'failed',
  'cancelled',
]);

export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const PlanStepStatusSchema = z.enum([
  'pending',
  'simulating',
  'simulated',
  'executing',
  'completed',
  'failed',
  'skipped',
]);

export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;

export const PlanStepSchema = z.object({
  id: z.string(),
  planId: z.string(),
  stepIndex: z.number(),
  chainId: z.number(),
  contract: z.string(),
  functionName: z.string(),
  params: z.record(z.unknown()),
  simulation: z.object({
    success: z.boolean(),
    gasUsed: z.string().optional(),
    balanceChanges: z.array(z.object({
      token: z.string(),
      before: z.string(),
      after: z.string(),
      delta: z.string(),
    })).optional(),
    events: z.array(z.object({
      name: z.string(),
      args: z.record(z.unknown()),
    })).optional(),
    error: z.string().optional(),
  }).optional(),
  txHash: z.string().optional(),
  status: PlanStepStatusSchema,
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  originalPrompt: z.string(),
  parsedIntent: ParsedIntentSchema,
  steps: z.array(PlanStepSchema),
  riskScore: z.number().min(0).max(1),
  status: PlanStatusSchema,
  simulation: z.object({
    overallSuccess: z.boolean(),
    totalGasEstimate: z.string(),
    simulatedAt: z.string().datetime(),
    warnings: z.array(z.string()).optional(),
  }).optional(),
  transactions: z.array(z.string()).optional(), // Transaction hashes
  createdAt: z.string().datetime(),
  executedAt: z.string().datetime().optional(),
});

export type Plan = z.infer<typeof PlanSchema>;

// ============================================================================
// AI ENGINE CONFIGURATION
// ============================================================================

export interface AIEngineConfig {
  anthropicApiKey: string;
  model: 'claude-3-5-sonnet-20241022' | 'claude-3-opus-20240229' | 'claude-3-haiku-20240307';
  maxTokens: number;
  temperature: number;
  fallbackModel?: string;
  fallbackApiKey?: string;
}

export interface ProcessRequest {
  prompt: string;
  userId: string;
  walletAddress: string;
  context?: {
    chainId?: number;
    availableBalances?: Record<string, string>;
    previousPlans?: string[];
  };
}

export interface ProcessResponse {
  success: boolean;
  intent: ParsedIntent | null;
  error?: string;
  processingTimeMs: number;
}
