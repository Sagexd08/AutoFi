# @autofi/ai-engine

Autofi AI Engine - Natural Language to On-chain Intent Parser

## Overview

This package provides the core AI capabilities for Autofi, converting natural language commands into structured, executable blockchain operations.

## Features

- **Natural Language Processing**: Uses Claude 3.5 Sonnet for high-accuracy intent parsing
- **Function Registry**: Complete set of DeFi operations (transfer, swap, stake, etc.)
- **Zod Schema Validation**: Strict type safety for all parsed intents
- **Multi-chain Support**: 12 EVM chains at launch
- **Streaming Support**: Real-time parsing updates for UI
- **Conversation History**: Context-aware follow-up processing

## Usage

```typescript
import { createAIEngine } from '@autofi/ai-engine';

const engine = createAIEngine({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

const result = await engine.process({
  prompt: 'Swap 1000 USDC for ETH on Arbitrum',
  userId: 'user-123',
  walletAddress: '0x...',
});

if (result.success) {
  console.log(result.intent);
  // {
  //   intentType: 'single_action',
  //   steps: [{
  //     function: 'swap',
  //     params: { tokenIn: 'USDC', tokenOut: 'ETH', amount: '1000', chain: 'arbitrum' }
  //   }],
  //   confidence: 0.95,
  //   ...
  // }
}
```

## Supported Functions

### Transfer
- `transfer(token, amount, to, chain, schedule?)`

### DeFi
- `swap(tokenIn, tokenOut, amount, slippage, chain)`
- `addLiquidity(pool, amounts, chain)`
- `removeLiquidity(pool, percentage, chain)`
- `stake(token, amount, protocol, chain)`
- `unstake(token, amount, protocol, chain)`
- `claimRewards(protocol, chain)`
- `deposit(vault, amount, chain)`
- `withdraw(vault, amount, chain)`

### Treasury
- `createStream(recipient, amountPerSec, token, chain)`
- `setRecurringPayment(recipient, amount, frequency, token, chain)`

### Governance
- `vote(proposalId, choice, dao, chain)`
- `delegate(votingPowerTo, dao, chain)`

### Advanced
- `executeMulticall(calls[], chain)`
- `setAutoRebalance(conditions, targetAllocations, chains)`
- `hedgePosition(strategy, triggerConditions, chain)`
- `deployContract(type, params, chain)`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `anthropicApiKey` | string | required | Anthropic API key |
| `model` | string | `claude-3-5-sonnet-20241022` | Claude model to use |
| `maxTokens` | number | 4096 | Max tokens in response |
| `temperature` | number | 0.1 | LLM temperature (low for consistency) |

## Environment Variables

- `ANTHROPIC_API_KEY`: Required. Your Anthropic API key.
