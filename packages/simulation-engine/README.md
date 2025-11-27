# @autofi/simulation-engine

> Transaction simulation and explainable AI preview for Autofi

## 🎬 Overview

The Simulation Engine provides a "preview before you sign" experience. It simulates transactions off-chain, analyzes the results, and uses AI to explain exactly what will happen in plain English.

## ✨ Features

### 🎮 Simulation
- **Tenderly Integration**: Production-grade simulation accuracy
- **Mock Mode**: Robust local simulation for development/testing
- **Asset Changes**: Tracks all token transfers and balance updates
- **State Changes**: Detects approvals, ownership transfers, etc.

### 🧠 Explainable AI
- **Natural Language**: Converts complex logs into simple English
- **Risk Analysis**: Identifies high gas, slippage, and other risks
- **Financial Impact**: Calculates net value change in USD
- **Step-by-Step**: Breaks down execution flow

### 👁️ Visual Diff
- **Balance Changes**: Clear before/after comparison
- **Approval Tracking**: Highlights new approvals or revocations
- **Formatted Output**: CLI-friendly display format

## 📦 Installation

```bash
pnpm add @autofi/simulation-engine
```

## 🚀 Quick Start

```typescript
import { Simulator, Explainer, VisualDiff } from '@autofi/simulation-engine';

// 1. Initialize
const simulator = new Simulator({ mockSimulation: true });
const explainer = new Explainer({ mockSimulation: true });

// 2. Define transaction
const request = {
  chainId: 1,
  from: '0xUser...',
  to: '0xRouter...',
  data: '0x...',
  value: '1000000000000000000', // 1 ETH
};

// 3. Simulate
const result = await simulator.simulate(request);

// 4. Explain
const explanation = await explainer.explain(result);

// 5. Visualize
const diff = VisualDiff.generateDiff(result);

// Display
console.log('📝 Summary:', explanation.summary);
console.log('\n👣 Steps:');
explanation.steps.forEach(s => console.log(`- ${s}`));
console.log('\n' + VisualDiff.formatDiff(diff));
```

## 🔧 Configuration

```typescript
const config = {
  tenderlyApiKey: '...',      // Optional: for real simulation
  openaiApiKey: '...',        // Optional: for AI explanation
  mockSimulation: false,      // Set true to force mock mode
  enableAiExplanation: true,  // Enable/disable AI
};
```

## 📝 License

MIT
