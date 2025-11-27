# @autofi/security-scanner

> Real-time contract scanning and security analysis for Autofi

## 🔒 Overview

The Security Scanner is Autofi's first line of defense against malicious contracts and rug pulls. It performs comprehensive security analysis before any contract interaction, giving users confidence and transparency.

## ✨ Features

### 🔍 Bytecode Analysis
- Detects proxy patterns (EIP-1967, EIP-1167)
- Identifies reentrancy vulnerabilities
- Finds dangerous functions (selfdestruct, delegatecall)
- Analyzes arithmetic safety
- Estimates contract complexity

### 🎯 Token Security
- Holder concentration analysis
- Liquidity lock verification
- Hidden fee detection
- Honeypot identification
- Rug pull risk scoring

### 📊 Risk Assessment
- Multi-factor risk scoring (0-100)
- Risk level classification (Low/Medium/High/Critical)
- Automated recommendations
- Exploit history checking
- Verification status

### ⚡ Performance
- Result caching (configurable duration)
- Parallel security checks
- Optimized bytecode parsing

## 📦 Installation

```bash
pnpm add @autofi/security-scanner
```

## 🚀 Quick Start

```typescript
import { SecurityScanner } from '@autofi/security-scanner';

// Create scanner instance
const scanner = new SecurityScanner({
  enableBytecodeAnalysis: true,
  cacheResults: true,
  cacheDuration: 3600, // 1 hour
});

// Scan a contract
const result = await scanner.scanContract(
  '0x1234567890123456789012345678901234567890',
  1 // Ethereum mainnet
);

// Check risk level
if (result.overallRisk === 'critical' || result.overallRisk === 'high') {
  console.log('⚠️ High risk detected! Do not proceed.');
  console.log(result.recommendations);
} else {
  console.log('✅ Contract appears safe');
}

// Display formatted result
console.log(SecurityScanner.formatScanResult(result));
```

## 📖 API Reference

### SecurityScanner

#### Constructor

```typescript
new SecurityScanner(config?: Partial<SecurityScannerConfig>)
```

**Config Options:**
```typescript
{
  enableBlockSec: boolean;        // Enable BlockSec API (default: true)
  enableCertiK: boolean;          // Enable CertiK API (default: true)
  enableDefiSafety: boolean;      // Enable DeFi Safety API (default: true)
  enableBytecodeAnalysis: boolean; // Enable bytecode analysis (default: true)
  cacheResults: boolean;          // Cache scan results (default: true)
  cacheDuration: number;          // Cache duration in seconds (default: 3600)
  riskThresholds: {
    low: number;                  // Low risk threshold (default: 25)
    medium: number;               // Medium risk threshold (default: 50)
    high: number;                 // High risk threshold (default: 75)
  };
}
```

#### Methods

##### `scanContract(address, chainId)`

Performs comprehensive security scan on a contract.

```typescript
async scanContract(
  contractAddress: Address,
  chainId: number = 1
): Promise<ContractScanResult>
```

**Returns:**
```typescript
{
  contractAddress: string;
  chainId: number;
  timestamp: number;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;              // 0-100
  checks: SecurityCheck[];
  isVerified: boolean;
  hasRecentExploits: boolean;
  rugPullRisk: number;            // 0-100
  recommendations: string[];
}
```

##### `clearCache()`

Clears the result cache.

```typescript
clearCache(): void
```

##### `formatScanResult(result)` (static)

Formats scan result for console display.

```typescript
static formatScanResult(result: ContractScanResult): string
```

### RiskAnalyzer

Utility class for risk calculation and analysis.

#### Methods

##### `calculateRiskScore(checks)`

```typescript
static calculateRiskScore(checks: SecurityCheck[]): number
```

##### `getRiskLevel(riskScore)`

```typescript
static getRiskLevel(riskScore: number): RiskLevel
```

##### `calculateRugPullRisk()`

```typescript
static calculateRugPullRisk(
  topHolderConcentration: number,
  liquidityLocked: boolean,
  hasHiddenFees: boolean,
  contractAge: number
): number
```

##### `generateRecommendations(result)`

```typescript
static generateRecommendations(result: ContractScanResult): string[]
```

### BytecodeAnalyzer

Low-level bytecode analysis utilities.

#### Methods

##### `analyze(bytecode, address)`

```typescript
static async analyze(bytecode: string, address: string): Promise<SecurityCheck[]>
```

##### `extractFunctionSelectors(bytecode)`

```typescript
static extractFunctionSelectors(bytecode: string): string[]
```

##### `estimateComplexity(bytecode)`

```typescript
static estimateComplexity(bytecode: string): {
  score: number;
  level: 'simple' | 'moderate' | 'complex' | 'very_complex';
}
```

##### `checkMaliciousPatterns(bytecode)`

```typescript
static checkMaliciousPatterns(bytecode: string): SecurityCheck[]
```

## 🎨 Example Output

```
═══════════════════════════════════════════════════
🔒 AUTOFI SECURITY SCAN RESULT
═══════════════════════════════════════════════════

Contract: 0x1234567890123456789012345678901234567890
Chain ID: 1
Scanned: 1/15/2025, 10:30:00 AM

Overall Risk: 🟡 35/100 - MEDIUM

✅ Contract verified on block explorer
🟡 Rug pull risk: 42/100

───────────────────────────────────────────────────
SECURITY CHECKS:
───────────────────────────────────────────────────
✅ Bytecode Existence
   Contract bytecode found

❌ Reentrancy Risk [HIGH]
   Potential reentrancy vulnerability detected
   Details: {"pattern":"CALL followed by SSTORE","occurrences":8}

✅ Contract Verification
   Contract is verified on block explorer

❌ Holder Concentration [HIGH]
   Top holders control 65.3% of supply
   Details: {"concentration":65.3}

✅ Liquidity Lock
   Liquidity is locked

───────────────────────────────────────────────────
RECOMMENDATIONS:
───────────────────────────────────────────────────
⚠️ Moderate rug pull risk. Review token distribution and liquidity locks.
⚠️ 1 high-severity issue(s) found. Review carefully before proceeding.
═══════════════════════════════════════════════════
```

## 🔧 Advanced Usage

### Custom Risk Thresholds

```typescript
const scanner = new SecurityScanner({
  riskThresholds: {
    low: 20,
    medium: 40,
    high: 60,
  },
});
```

### Disable Caching

```typescript
const scanner = new SecurityScanner({
  cacheResults: false,
});
```

### Bytecode-Only Analysis

```typescript
import { BytecodeAnalyzer } from '@autofi/security-scanner';

const bytecode = '0x608060405234801561001057600080fd5b50...';
const checks = await BytecodeAnalyzer.analyze(bytecode, address);
const complexity = BytecodeAnalyzer.estimateComplexity(bytecode);
const selectors = BytecodeAnalyzer.extractFunctionSelectors(bytecode);
```

## 🛡️ Security Checks Performed

| Check | Description | Severity |
|-------|-------------|----------|
| **Bytecode Existence** | Verifies contract exists at address | Critical |
| **Contract Verification** | Checks if source code is verified | High |
| **Proxy Detection** | Identifies proxy patterns | Low |
| **Reentrancy Risk** | Detects potential reentrancy vulnerabilities | High |
| **Dangerous Functions** | Finds selfdestruct, kill, destroy functions | High |
| **Arithmetic Safety** | Checks for overflow protection | Medium |
| **External Calls** | Analyzes external call patterns | Medium |
| **Honeypot Detection** | Identifies honeypot patterns | Critical |
| **Holder Concentration** | Analyzes token distribution | High |
| **Liquidity Lock** | Verifies liquidity is locked | High |
| **Hidden Fees** | Detects transfer taxes | Medium |
| **Contract Age** | Checks contract deployment date | Medium |
| **Exploit History** | Searches exploit databases | Critical |
| **Mint Function** | Detects unrestricted minting | Medium |
| **Complexity Analysis** | Estimates contract complexity | Low |

## 🎯 Risk Scoring

Risk scores are calculated using a weighted system:

- **Critical** issues: 4x weight
- **High** issues: 3x weight
- **Medium** issues: 2x weight
- **Low** issues: 1x weight

**Risk Levels:**
- **Low (0-24)**: 🟢 Generally safe
- **Medium (25-49)**: 🟡 Review carefully
- **High (50-74)**: 🟠 Proceed with caution
- **Critical (75-100)**: 🔴 Do not proceed

## 🔮 Future Enhancements

- [ ] Integration with BlockSec API
- [ ] Integration with CertiK API
- [ ] Integration with DeFi Safety database
- [ ] Real-time exploit monitoring
- [ ] Machine learning-based pattern detection
- [ ] Historical vulnerability tracking
- [ ] Multi-chain support expansion
- [ ] Gas optimization analysis
- [ ] Formal verification integration

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/LNC-Network/AutoFi/issues)
- Discord: [Join community](https://discord.gg/autofi)
