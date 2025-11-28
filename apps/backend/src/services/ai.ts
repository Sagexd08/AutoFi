/**
 * AI Service
 * Handles intent parsing, automation planning, and ML-based features
 * Uses OpenAI for LLM-based parsing with regex fallback
 */

import OpenAI from 'openai';
import { vectorDBService } from './vector-db.js';
import { logger } from '../utils/logger.js';

// OpenAI client (initialized lazily)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set, falling back to regex-based parsing');
    return null;
  }
  
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface ParsedIntent {
  action: 'swap' | 'transfer' | 'stake' | 'unstake' | 'mint' | 'vote' | 'bridge' | 'approve' | 'unknown';
  tokens: string[];
  amounts: string[];
  addresses: string[];
  conditions: {
    type: 'price' | 'time' | 'balance' | 'none';
    value?: string;
    operator?: 'above' | 'below' | 'equals' | 'at';
  }[];
  schedule?: {
    type: 'once' | 'daily' | 'weekly' | 'monthly';
    time?: string;
  };
  confidence: number;
  rawResponse?: string;
}

export interface ExecutionPlan {
  id: string;
  intent: ParsedIntent;
  steps: ExecutionStep[];
  estimatedGas: string;
  risks: Risk[];
  recommendations: string[];
}

export interface ExecutionStep {
  id: number;
  type: string;
  action: string;
  params: Record<string, any>;
  description: string;
  estimatedGas: string;
}

export interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  mitigation?: string;
}

// Token patterns
const TOKEN_PATTERNS: Record<string, RegExp> = {
  CELO: /\bcelo\b/i,
  cUSD: /\bc?usd\b/i,
  cEUR: /\bc?eur\b/i,
  cREAL: /\bc?real\b/i,
  USDC: /\busdc\b/i,
  USDT: /\busdt\b/i,
  ETH: /\beth(ereum)?\b/i,
};

// Action patterns
const ACTION_PATTERNS: Record<string, RegExp[]> = {
  swap: [/\bswap\b/i, /\bexchange\b/i, /\btrade\b/i, /\bconvert\b/i],
  transfer: [/\btransfer\b/i, /\bsend\b/i, /\bpay\b/i],
  stake: [/\bstake\b/i, /\block\b/i, /\bvalidat/i],
  unstake: [/\bunstake\b/i, /\bunlock\b/i, /\bwithdraw.*stake\b/i],
  mint: [/\bmint\b/i, /\bcreate.*nft\b/i],
  vote: [/\bvote\b/i, /\bpropos/i, /\bgovern/i],
  bridge: [/\bbridge\b/i, /\bcross.?chain\b/i],
  approve: [/\bapprove\b/i, /\ballow/i],
};

// Condition patterns
const CONDITION_PATTERNS = {
  price: /\b(when|if).*price.*(above|below|reaches?)\s*\$?([\d.]+)/i,
  time: /\b(at|every|daily|weekly|monthly)\s*([\d:]+\s*(am|pm)?)?/i,
  balance: /\b(when|if).*balance.*(above|below|reaches?)\s*([\d.]+)/i,
};

class AIService {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await vectorDBService.initialize();
    this.initialized = true;
    logger.info('AI Service initialized');
  }

  /**
   * Parse user prompt using LLM (with regex fallback)
   */
  async parseIntent(prompt: string, walletAddress: string): Promise<ParsedIntent> {
    await this.ensureInitialized();

    // Try LLM-based parsing first
    const client = getOpenAIClient();
    if (client) {
      try {
        const intent = await this.parseIntentWithLLM(client, prompt);
        await vectorDBService.storePrompt(walletAddress, prompt, intent);
        return intent;
      } catch (error) {
        logger.warn('LLM parsing failed, falling back to regex', { error: String(error) });
      }
    }

    // Fallback to regex-based parsing
    return this.parseIntentWithRegex(prompt, walletAddress);
  }

  /**
   * Parse intent using OpenAI LLM
   */
  private async parseIntentWithLLM(client: OpenAI, prompt: string): Promise<ParsedIntent> {
    const systemPrompt = `You are a blockchain transaction intent parser for the Celo network.
Parse the user's natural language request into a structured JSON intent.

Respond with ONLY valid JSON in this exact format:
{
  "action": "swap" | "transfer" | "stake" | "unstake" | "mint" | "vote" | "bridge" | "approve" | "unknown",
  "tokens": ["array of token symbols mentioned, e.g., CELO, cUSD, cEUR, USDC"],
  "amounts": ["array of amounts as strings, e.g., 100, 50.5"],
  "addresses": ["array of 0x addresses mentioned"],
  "conditions": [{"type": "price" | "time" | "balance" | "none", "value": "optional value", "operator": "above" | "below" | "equals" | "at"}],
  "schedule": {"type": "once" | "daily" | "weekly" | "monthly", "time": "optional time string"} or null,
  "confidence": 0.0 to 1.0
}

Examples:
- "swap 100 CELO for cUSD" → action: "swap", tokens: ["CELO", "cUSD"], amounts: ["100"]
- "send 50 cUSD to 0x123..." → action: "transfer", tokens: ["cUSD"], amounts: ["50"], addresses: ["0x123..."]
- "stake my CELO when price is above $1" → action: "stake", tokens: ["CELO"], conditions: [{"type": "price", "value": "1", "operator": "above"}]`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content);
    
    return {
      action: parsed.action || 'unknown',
      tokens: parsed.tokens || [],
      amounts: parsed.amounts || [],
      addresses: parsed.addresses || [],
      conditions: parsed.conditions || [],
      schedule: parsed.schedule || undefined,
      confidence: Math.min(parsed.confidence || 0.9, 0.99),
      rawResponse: content,
    };
  }

  /**
   * Fallback regex-based intent parsing
   */
  private async parseIntentWithRegex(prompt: string, walletAddress: string): Promise<ParsedIntent> {
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    // Detect action
    let action: ParsedIntent['action'] = 'unknown';
    let maxMatches = 0;
    
    for (const [actionType, patterns] of Object.entries(ACTION_PATTERNS)) {
      const matches = patterns.filter(p => p.test(normalizedPrompt)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        action = actionType as ParsedIntent['action'];
      }
    }

    // Extract tokens
    const tokens: string[] = [];
    for (const [token, pattern] of Object.entries(TOKEN_PATTERNS)) {
      if (pattern.test(normalizedPrompt)) {
        tokens.push(token);
      }
    }

    // Extract amounts
    const amountPattern = /(\d+(?:\.\d+)?)\s*(?:celo|cusd|ceur|usdc|usdt|eth|tokens?)?/gi;
    const amounts: string[] = [];
    let match;
    while ((match = amountPattern.exec(normalizedPrompt)) !== null) {
      amounts.push(match[1]);
    }

    // Extract addresses
    const addressPattern = /0x[a-fA-F0-9]{40}/g;
    const addresses = normalizedPrompt.match(addressPattern) || [];

    // Extract conditions
    const conditions: ParsedIntent['conditions'] = [];
    
    const priceMatch = CONDITION_PATTERNS.price.exec(normalizedPrompt);
    if (priceMatch) {
      conditions.push({
        type: 'price',
        operator: priceMatch[2].toLowerCase() as any,
        value: priceMatch[3],
      });
    }

    const balanceMatch = CONDITION_PATTERNS.balance.exec(normalizedPrompt);
    if (balanceMatch) {
      conditions.push({
        type: 'balance',
        operator: balanceMatch[2].toLowerCase() as any,
        value: balanceMatch[3],
      });
    }

    // Extract schedule
    let schedule: ParsedIntent['schedule'] | undefined;
    const timeMatch = CONDITION_PATTERNS.time.exec(normalizedPrompt);
    if (timeMatch) {
      if (/daily/i.test(normalizedPrompt)) {
        schedule = { type: 'daily', time: timeMatch[2] };
      } else if (/weekly/i.test(normalizedPrompt)) {
        schedule = { type: 'weekly', time: timeMatch[2] };
      } else if (/monthly/i.test(normalizedPrompt)) {
        schedule = { type: 'monthly', time: timeMatch[2] };
      } else {
        schedule = { type: 'once', time: timeMatch[2] };
      }
    }

    // Calculate confidence
    let confidence = 0.5;
    if (action !== 'unknown') confidence += 0.2;
    if (tokens.length > 0) confidence += 0.15;
    if (amounts.length > 0) confidence += 0.1;
    if (conditions.length > 0 || schedule) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);

    // Store prompt for learning
    const intent: ParsedIntent = {
      action,
      tokens,
      amounts,
      addresses,
      conditions,
      schedule,
      confidence,
    };

    await vectorDBService.storePrompt(walletAddress, prompt, intent);

    return intent;
  }

  /**
   * Generate execution plan from intent
   */
  async generatePlan(intent: ParsedIntent, walletAddress: string): Promise<ExecutionPlan> {
    await this.ensureInitialized();

    const steps: ExecutionStep[] = [];
    const risks: Risk[] = [];
    const recommendations: string[] = [];
    let estimatedGas = '0';

    // Look for similar automations
    const similarAutomations = await vectorDBService.getSimilarAutomations(
      `${intent.action} ${intent.tokens.join(' ')}`,
      walletAddress,
      3
    );

    if (similarAutomations.length > 0) {
      recommendations.push(
        `Found ${similarAutomations.length} similar automation(s) from your history`
      );
    }

    // Generate steps based on action type
    switch (intent.action) {
      case 'swap':
        steps.push(...this.generateSwapSteps(intent));
        estimatedGas = '150000';
        risks.push({
          level: 'medium',
          type: 'slippage',
          description: 'Token swap may be affected by slippage',
          mitigation: 'Consider setting a slippage tolerance of 0.5-1%',
        });
        break;

      case 'transfer':
        steps.push(...this.generateTransferSteps(intent));
        estimatedGas = '21000';
        risks.push({
          level: 'low',
          type: 'address_verification',
          description: 'Ensure the recipient address is correct',
        });
        break;

      case 'stake':
        steps.push(...this.generateStakeSteps(intent));
        estimatedGas = '200000';
        risks.push({
          level: 'medium',
          type: 'lock_period',
          description: 'Staked tokens may have a lock-up period',
        });
        break;

      case 'unstake':
        steps.push(...this.generateUnstakeSteps(intent));
        estimatedGas = '150000';
        break;

      case 'mint':
        steps.push(...this.generateMintSteps(intent));
        estimatedGas = '250000';
        break;

      case 'vote':
        steps.push(...this.generateVoteSteps(intent));
        estimatedGas = '80000';
        break;

      default:
        recommendations.push('Could not fully understand your intent. Please be more specific.');
    }

    // Add approval step if needed
    if (['swap', 'stake'].includes(intent.action) && intent.tokens.length > 0) {
      steps.unshift({
        id: 0,
        type: 'approval',
        action: 'approve',
        params: {
          token: intent.tokens[0],
          spender: 'protocol_address',
          amount: intent.amounts[0] || 'unlimited',
        },
        description: `Approve ${intent.tokens[0]} spending`,
        estimatedGas: '50000',
      });
    }

    // Add condition steps if needed
    if (intent.conditions.length > 0) {
      steps.unshift({
        id: -1,
        type: 'condition',
        action: 'wait_for_condition',
        params: {
          conditions: intent.conditions,
        },
        description: `Wait for condition: ${intent.conditions.map(c => `${c.type} ${c.operator} ${c.value}`).join(', ')}`,
        estimatedGas: '0',
      });
    }

    // Re-number steps
    steps.forEach((step, index) => {
      step.id = index + 1;
    });

    return {
      id: `plan_${Date.now()}`,
      intent,
      steps,
      estimatedGas,
      risks,
      recommendations,
    };
  }

  private generateSwapSteps(intent: ParsedIntent): ExecutionStep[] {
    const [tokenIn, tokenOut] = intent.tokens.length >= 2 
      ? [intent.tokens[0], intent.tokens[1]]
      : [intent.tokens[0] || 'CELO', 'cUSD'];
    
    const amount = intent.amounts[0] || '1';

    return [{
      id: 1,
      type: 'swap',
      action: 'swap_tokens',
      params: {
        tokenIn,
        tokenOut,
        amountIn: amount,
        slippage: 0.5,
        deadline: 1800, // 30 minutes
      },
      description: `Swap ${amount} ${tokenIn} for ${tokenOut}`,
      estimatedGas: '150000',
    }];
  }

  private generateTransferSteps(intent: ParsedIntent): ExecutionStep[] {
    const token = intent.tokens[0] || 'CELO';
    const amount = intent.amounts[0] || '0';
    const to = intent.addresses[0] || '';

    return [{
      id: 1,
      type: 'transfer',
      action: 'transfer_tokens',
      params: {
        token,
        amount,
        to,
      },
      description: `Transfer ${amount} ${token} to ${to.slice(0, 10)}...`,
      estimatedGas: '21000',
    }];
  }

  private generateStakeSteps(intent: ParsedIntent): ExecutionStep[] {
    const token = intent.tokens[0] || 'CELO';
    const amount = intent.amounts[0] || '0';

    return [{
      id: 1,
      type: 'stake',
      action: 'stake_tokens',
      params: {
        token,
        amount,
        validator: 'auto', // Auto-select best validator
      },
      description: `Stake ${amount} ${token}`,
      estimatedGas: '200000',
    }];
  }

  private generateUnstakeSteps(intent: ParsedIntent): ExecutionStep[] {
    const token = intent.tokens[0] || 'CELO';
    const amount = intent.amounts[0] || 'all';

    return [{
      id: 1,
      type: 'unstake',
      action: 'unstake_tokens',
      params: {
        token,
        amount,
      },
      description: `Unstake ${amount} ${token}`,
      estimatedGas: '150000',
    }];
  }

  private generateMintSteps(_intent: ParsedIntent): ExecutionStep[] {
    return [{
      id: 1,
      type: 'mint',
      action: 'mint_nft',
      params: {
        collection: 'user_collection',
        metadata: {},
      },
      description: 'Mint new NFT',
      estimatedGas: '250000',
    }];
  }

  private generateVoteSteps(_intent: ParsedIntent): ExecutionStep[] {
    return [{
      id: 1,
      type: 'vote',
      action: 'cast_vote',
      params: {
        proposalId: 'latest',
        support: true,
      },
      description: 'Vote on governance proposal',
      estimatedGas: '80000',
    }];
  }

  /**
   * Get personalized recommendations based on user history
   */
  async getRecommendations(walletAddress: string): Promise<string[]> {
    await this.ensureInitialized();

    const context = await vectorDBService.getUserContext(walletAddress, 20);
    const recommendations: string[] = [];

    // Analyze patterns
    const actionCounts: Record<string, number> = {};
    for (const entry of context) {
      if (entry.metadata.parsedIntent?.action) {
        const action = entry.metadata.parsedIntent.action;
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      }
    }

    // Generate recommendations based on usage
    const mostUsedAction = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (mostUsedAction) {
      recommendations.push(
        `You frequently use ${mostUsedAction[0]} operations. Consider setting up automated ${mostUsedAction[0]} schedules.`
      );
    }

    return recommendations;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const aiService = new AIService();
export default aiService;
