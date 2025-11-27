/**
 * @autofi/security-scanner
 * 
 * Real-time contract scanning and security analysis for Autofi
 * 
 * Features:
 * - Contract bytecode analysis
 * - Vulnerability detection
 * - Rug pull risk assessment
 * - Token holder analysis
 * - Exploit history checking
 * - Verification status
 */

export { SecurityScanner } from './scanner';
export { RiskAnalyzer } from './risk-analyzer';
export { BytecodeAnalyzer } from './bytecode-analyzer';

export type {
    ContractScanResult,
    SecurityCheck,
    TokenAnalysis,
    ExploitRecord,
    SecurityScannerConfig,
} from './types';

export { RiskLevel } from './types';
