import { z } from 'zod';

/**
 * Risk levels for contract security assessment
 */
export enum RiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * Security check result
 */
export interface SecurityCheck {
    name: string;
    passed: boolean;
    severity: RiskLevel;
    message: string;
    details?: Record<string, any>;
}

/**
 * Contract scan result
 */
export interface ContractScanResult {
    contractAddress: string;
    chainId: number;
    timestamp: number;
    overallRisk: RiskLevel;
    riskScore: number; // 0-100
    checks: SecurityCheck[];
    isVerified: boolean;
    hasRecentExploits: boolean;
    rugPullRisk: number; // 0-100
    recommendations: string[];
}

/**
 * Token analysis result
 */
export interface TokenAnalysis {
    address: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    holderCount?: number;
    topHolderConcentration: number; // percentage
    hasTransferTax: boolean;
    transferTaxPercentage?: number;
    hasHiddenFees: boolean;
    liquidityLocked: boolean;
    liquidityLockDuration?: number; // in seconds
    isHoneypot: boolean;
}

/**
 * Exploit database entry
 */
export interface ExploitRecord {
    protocolName: string;
    contractAddress: string;
    chainId: number;
    exploitDate: string;
    lossAmount: string;
    description: string;
    source: string;
}

/**
 * Configuration for security scanner
 */
export const SecurityScannerConfigSchema = z.object({
    enableBlockSec: z.boolean().default(true),
    enableCertiK: z.boolean().default(true),
    enableDefiSafety: z.boolean().default(true),
    enableBytecodeAnalysis: z.boolean().default(true),
    cacheResults: z.boolean().default(true),
    cacheDuration: z.number().default(3600), // 1 hour in seconds
    riskThresholds: z.object({
        low: z.number().default(25),
        medium: z.number().default(50),
        high: z.number().default(75),
    }),
});

export type SecurityScannerConfig = z.infer<typeof SecurityScannerConfigSchema>;

/**
 * API response schemas
 */
export const BlockSecResponseSchema = z.object({
    address: z.string(),
    is_verified: z.boolean(),
    security_score: z.number(),
    vulnerabilities: z.array(z.object({
        type: z.string(),
        severity: z.string(),
        description: z.string(),
    })),
});

export const CertiKResponseSchema = z.object({
    address: z.string(),
    audit_status: z.string(),
    security_score: z.number(),
    findings: z.array(z.object({
        severity: z.string(),
        title: z.string(),
        description: z.string(),
    })),
});
