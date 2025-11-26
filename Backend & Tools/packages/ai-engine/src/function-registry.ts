import {
  FunctionCallSchema,
  SupportedChain,
  ChainIdMap,
  type FunctionCall,
} from './types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ============================================================================
// FUNCTION REGISTRY
// ============================================================================

export interface FunctionDefinition {
  name: string;
  description: string;
  category: 'transfer' | 'defi' | 'governance' | 'treasury' | 'nft' | 'advanced';
  supportedChains: SupportedChain[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  gasEstimate: 'low' | 'medium' | 'high' | 'variable';
  examples: string[];
}

export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  transfer: {
    name: 'transfer',
    description: 'Transfer tokens from your wallet to another address. Supports native tokens and ERC20s.',
    category: 'transfer',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'medium',
    requiresApproval: false,
    gasEstimate: 'low',
    examples: [
      'Send 100 USDC to 0x1234...5678',
      'Transfer 0.5 ETH to vitalik.eth',
      'Pay 500 USDC to the team wallet every 1st and 15th',
    ],
  },
  swap: {
    name: 'swap',
    description: 'Swap one token for another using optimal DEX routing.',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'medium',
    requiresApproval: false,
    gasEstimate: 'medium',
    examples: [
      'Swap 1000 USDC for ETH',
      'Exchange all my WBTC for USDC with max 1% slippage',
      'Convert 50% of my ETH to stablecoins',
    ],
  },
  addLiquidity: {
    name: 'addLiquidity',
    description: 'Add liquidity to a DEX pool (Uniswap, Sushi, Curve, etc.)',
    category: 'defi',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'high',
    examples: [
      'Add liquidity to USDC/ETH pool on Uniswap',
      'Provide $10k liquidity to the Curve 3pool',
    ],
  },
  removeLiquidity: {
    name: 'removeLiquidity',
    description: 'Remove liquidity from a DEX pool.',
    category: 'defi',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'],
    riskLevel: 'medium',
    requiresApproval: false,
    gasEstimate: 'medium',
    examples: [
      'Remove 50% of my Uniswap USDC/ETH LP',
      'Exit all liquidity positions on Arbitrum',
    ],
  },
  stake: {
    name: 'stake',
    description: 'Stake tokens in a staking protocol (Lido, Rocket Pool, etc.)',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'medium',
    requiresApproval: false,
    gasEstimate: 'medium',
    examples: [
      'Stake 10 ETH with Lido',
      'Stake all my MATIC for stMATIC',
    ],
  },
  unstake: {
    name: 'unstake',
    description: 'Unstake tokens from a staking protocol.',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'low',
    requiresApproval: false,
    gasEstimate: 'medium',
    examples: [
      'Unstake all my stETH',
      'Withdraw 5 ETH from Lido staking',
    ],
  },
  claimRewards: {
    name: 'claimRewards',
    description: 'Claim pending rewards from DeFi protocols.',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'low',
    requiresApproval: false,
    gasEstimate: 'low',
    examples: [
      'Claim all my Aave rewards',
      'Harvest yield from all protocols on Polygon',
    ],
  },
  deposit: {
    name: 'deposit',
    description: 'Deposit tokens into a yield vault (Yearn, Beefy, etc.)',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'medium',
    examples: [
      'Deposit 5000 USDC into Yearn vault',
      'Put all my DAI into the highest yielding vault',
    ],
  },
  withdraw: {
    name: 'withdraw',
    description: 'Withdraw tokens from a yield vault.',
    category: 'defi',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'low',
    requiresApproval: false,
    gasEstimate: 'medium',
    examples: [
      'Withdraw all from Yearn USDC vault',
      'Exit my Beefy positions',
    ],
  },
  createStream: {
    name: 'createStream',
    description: 'Create a token stream for continuous payments (Superfluid, Sablier).',
    category: 'treasury',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'celo'],
    riskLevel: 'medium',
    requiresApproval: true,
    gasEstimate: 'medium',
    examples: [
      'Stream 1000 USDC per month to 0x1234',
      'Set up salary streaming for contractors',
    ],
  },
  deployContract: {
    name: 'deployContract',
    description: 'Deploy a smart contract (token, NFT, multisig, etc.)',
    category: 'advanced',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'high',
    examples: [
      'Deploy an ERC20 token called MyToken',
      'Create a new multisig wallet with 3 signers',
    ],
  },
  vote: {
    name: 'vote',
    description: 'Vote on a DAO governance proposal.',
    category: 'governance',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'low',
    requiresApproval: false,
    gasEstimate: 'low',
    examples: [
      'Vote YES on Uniswap proposal #42',
      'Vote against all proposals that increase token emissions',
    ],
  },
  delegate: {
    name: 'delegate',
    description: 'Delegate voting power to another address.',
    category: 'governance',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'low',
    requiresApproval: false,
    gasEstimate: 'low',
    examples: [
      'Delegate my UNI voting power to vitalik.eth',
      'Self-delegate all my governance tokens',
    ],
  },
  executeMulticall: {
    name: 'executeMulticall',
    description: 'Execute multiple contract calls in a single transaction.',
    category: 'advanced',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'variable',
    examples: [
      'Batch swap and stake in one transaction',
      'Execute multiple transfers atomically',
    ],
  },
  setAutoRebalance: {
    name: 'setAutoRebalance',
    description: 'Set up automatic portfolio rebalancing based on conditions.',
    category: 'advanced',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'variable',
    examples: [
      'Rebalance my portfolio to 60% ETH, 30% BTC, 10% stables weekly',
      'Keep my stablecoin ratio above 20% at all times',
    ],
  },
  setRecurringPayment: {
    name: 'setRecurringPayment',
    description: 'Set up recurring token payments.',
    category: 'treasury',
    supportedChains: Object.keys(ChainIdMap) as SupportedChain[],
    riskLevel: 'medium',
    requiresApproval: true,
    gasEstimate: 'low',
    examples: [
      'Pay 2000 USDC monthly to the dev team',
      'Auto-pay rent 1000 USDC on the 1st of every month',
    ],
  },
  hedgePosition: {
    name: 'hedgePosition',
    description: 'Automatically hedge positions based on market conditions.',
    category: 'advanced',
    supportedChains: ['ethereum', 'arbitrum', 'optimism'],
    riskLevel: 'high',
    requiresApproval: true,
    gasEstimate: 'variable',
    examples: [
      'If ETH drops 8% in 4 hours, move 40% to USDC',
      'Hedge my portfolio with 2x short when volatility spikes',
    ],
  },
};

/**
 * Get JSON schema for function calls (for Claude's structured output)
 */
export function getFunctionCallJsonSchema(): object {
  return zodToJsonSchema(FunctionCallSchema, {
    name: 'FunctionCall',
    $refStrategy: 'none',
  });
}

/**
 * Get function definition by name
 */
export function getFunctionDefinition(name: string): FunctionDefinition | undefined {
  return FUNCTION_REGISTRY[name];
}

/**
 * Get all functions for a category
 */
export function getFunctionsByCategory(category: FunctionDefinition['category']): FunctionDefinition[] {
  return Object.values(FUNCTION_REGISTRY).filter(fn => fn.category === category);
}

/**
 * Get all functions supported on a chain
 */
export function getFunctionsForChain(chain: SupportedChain): FunctionDefinition[] {
  return Object.values(FUNCTION_REGISTRY).filter(fn => fn.supportedChains.includes(chain));
}

/**
 * Build function registry documentation for LLM system prompt
 */
export function buildFunctionRegistryDocs(): string {
  const docs: string[] = ['# Available Functions\n'];
  
  const categories = [...new Set(Object.values(FUNCTION_REGISTRY).map(fn => fn.category))];
  
  for (const category of categories) {
    docs.push(`\n## ${category.toUpperCase()}\n`);
    const functions = getFunctionsByCategory(category);
    
    for (const fn of functions) {
      docs.push(`### ${fn.name}`);
      docs.push(`${fn.description}`);
      docs.push(`- **Chains**: ${fn.supportedChains.join(', ')}`);
      docs.push(`- **Risk Level**: ${fn.riskLevel}`);
      docs.push(`- **Examples**:`);
      for (const example of fn.examples) {
        docs.push(`  - "${example}"`);
      }
      docs.push('');
    }
  }
  
  return docs.join('\n');
}

/**
 * Validate a function call
 */
export function validateFunctionCall(call: unknown): { valid: boolean; error?: string; data?: FunctionCall } {
  const result = FunctionCallSchema.safeParse(call);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, error: result.error.message };
}
