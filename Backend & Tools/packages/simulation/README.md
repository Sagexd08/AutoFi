# @autofi/simulation

Autofi Simulation Engine - Fork-based Transaction Simulation

## Overview

This package provides transaction simulation capabilities using either Tenderly (cloud-based) or Anvil/Hardhat (local) for fork-based simulation.

## Features

- **Tenderly Integration**: Full cloud-based simulation with detailed traces
- **Anvil/Hardhat Support**: Local fork-based simulation
- **Bundle Simulation**: Simulate multiple transactions with state persistence
- **Balance Changes**: Track token and ETH balance changes
- **Event Parsing**: Parse emitted events from simulated transactions
- **Fork Management**: Create and manage fork instances

## Usage

### Tenderly Simulation

```typescript
import { createSimulationEngine } from '@autofi/simulation';

const engine = createSimulationEngine({
  provider: 'tenderly',
  tenderlyAccessKey: process.env.TENDERLY_ACCESS_KEY,
  tenderlyAccountSlug: 'your-account',
  tenderlyProjectSlug: 'your-project',
});

const result = await engine.simulate({
  from: '0x...',
  to: '0x...',
  value: '1000000000000000000', // 1 ETH
  data: '0x...',
  chainId: 1,
});

if (result.success) {
  console.log('Gas used:', result.totalGasUsed);
  console.log('Balance changes:', result.allBalanceChanges);
}
```

### Anvil/Local Simulation

```typescript
import { createSimulationEngine } from '@autofi/simulation';

const engine = createSimulationEngine({
  provider: 'anvil',
  anvilRpcUrl: 'http://127.0.0.1:8545',
});

// Create a fork from mainnet
await engine.createFork(1); // Ethereum mainnet

const result = await engine.simulate({
  from: '0x...',
  to: '0x...',
  value: '0',
  data: '0x...',
  chainId: 1,
});
```

### Bundle Simulation

```typescript
const result = await engine.simulateBundle([
  { from: '0x...', to: '0x...', value: '0', data: '0x...', chainId: 1 },
  { from: '0x...', to: '0x...', value: '0', data: '0x...', chainId: 1 },
], '0x...', 1);

// Each step maintains state from previous steps
for (const step of result.steps) {
  console.log(`Step ${step.stepIndex}: ${step.success ? 'SUCCESS' : 'FAILED'}`);
}
```

## Configuration

### Environment Variables

```env
# Simulation Provider
SIMULATION_PROVIDER=tenderly  # or 'anvil'

# Tenderly Configuration
TENDERLY_ACCESS_KEY=your-access-key
TENDERLY_ACCOUNT_SLUG=your-account
TENDERLY_PROJECT_SLUG=your-project

# Anvil Configuration
ANVIL_RPC_URL=http://127.0.0.1:8545
```

## Simulation Result

```typescript
interface SimulationResult {
  success: boolean;
  steps: StepSimulationResult[];
  totalGasUsed: string;
  allBalanceChanges: BalanceChange[];
  allEvents: EmittedEvent[];
  warnings: string[];
  errors: string[];
  simulatedAt: string;
  blockNumber: number;
  simulationUrl?: string; // Tenderly dashboard URL
}
```
