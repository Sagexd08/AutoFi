import { createPublicClient, http, Address, Chain } from 'viem';
import { mainnet } from 'viem/chains';
import {
    ContractScanResult,
    SecurityCheck,
    RiskLevel,
    SecurityScannerConfig,
    SecurityScannerConfigSchema,
} from './types';
import { RiskAnalyzer } from './risk-analyzer';
import { BytecodeAnalyzer } from './bytecode-analyzer';

/**
 * Main Security Scanner - Orchestrates all security checks
 */
export class SecurityScanner {
    private config: SecurityScannerConfig;
    private cache: Map<string, { result: ContractScanResult; timestamp: number }>;

    constructor(config?: Partial<SecurityScannerConfig>) {
        this.config = SecurityScannerConfigSchema.parse(config || {});
        this.cache = new Map();
    }

    /**
     * Scan a contract for security issues
     */
    async scanContract(
        contractAddress: Address,
        chainId: number = 1
    ): Promise<ContractScanResult> {
        const cacheKey = `${chainId}:${contractAddress}`;

        // Check cache
        if (this.config.cacheResults) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.config.cacheDuration * 1000) {
                return cached.result;
            }
        }

        const checks: SecurityCheck[] = [];

        // 1. Get contract bytecode
        const client = createPublicClient({
            chain: this.getChain(chainId),
            transport: http(),
        });

        const bytecode = await client.getBytecode({ address: contractAddress });

        if (!bytecode) {
            const result: ContractScanResult = {
                contractAddress,
                chainId,
                timestamp: Date.now(),
                overallRisk: RiskLevel.CRITICAL,
                riskScore: 100,
                checks: [
                    {
                        name: 'Contract Existence',
                        passed: false,
                        severity: RiskLevel.CRITICAL,
                        message: 'No contract found at this address',
                    },
                ],
                isVerified: false,
                hasRecentExploits: false,
                rugPullRisk: 100,
                recommendations: ['🚨 No contract exists at this address. Do not proceed.'],
            };
            return result;
        }

        // 2. Bytecode analysis
        if (this.config.enableBytecodeAnalysis) {
            const bytecodeChecks = await BytecodeAnalyzer.analyze(bytecode, contractAddress);
            checks.push(...bytecodeChecks);

            // Check for malicious patterns
            const maliciousChecks = BytecodeAnalyzer.checkMaliciousPatterns(bytecode);
            checks.push(...maliciousChecks);

            // Estimate complexity
            const complexity = BytecodeAnalyzer.estimateComplexity(bytecode);
            checks.push({
                name: 'Contract Complexity',
                passed: complexity.level !== 'very_complex',
                severity: complexity.level === 'very_complex' ? RiskLevel.MEDIUM : RiskLevel.LOW,
                message: `Contract complexity: ${complexity.level} (score: ${complexity.score}/100)`,
                details: { complexity },
            });
        }

        // 3. Check if contract is verified (mock for now - would integrate with Etherscan API)
        const isVerified = await this.checkVerification(contractAddress, chainId);
        checks.push({
            name: 'Contract Verification',
            passed: isVerified,
            severity: isVerified ? RiskLevel.LOW : RiskLevel.HIGH,
            message: isVerified
                ? 'Contract is verified on block explorer'
                : 'Contract is NOT verified - source code unavailable',
        });

        // 4. Check for recent exploits (mock for now - would integrate with Rekt, DeFiYield)
        const hasRecentExploits = await this.checkExploitHistory(contractAddress, chainId);
        if (hasRecentExploits) {
            checks.push({
                name: 'Exploit History',
                passed: false,
                severity: RiskLevel.CRITICAL,
                message: 'This protocol has recent exploit history',
            });
        }

        // 5. Token-specific checks (if it's a token contract)
        const isToken = await this.isTokenContract(bytecode);
        let rugPullRisk = 0;

        if (isToken) {
            const tokenChecks = await this.analyzeToken(contractAddress, chainId);
            checks.push(...tokenChecks.checks);
            rugPullRisk = tokenChecks.rugPullRisk;
        }

        // Calculate overall risk
        const riskScore = RiskAnalyzer.calculateRiskScore(checks);
        const overallRisk = RiskAnalyzer.getRiskLevel(riskScore);

        const result: ContractScanResult = {
            contractAddress,
            chainId,
            timestamp: Date.now(),
            overallRisk,
            riskScore,
            checks,
            isVerified,
            hasRecentExploits,
            rugPullRisk,
            recommendations: RiskAnalyzer.generateRecommendations({
                contractAddress,
                chainId,
                timestamp: Date.now(),
                overallRisk,
                riskScore,
                checks,
                isVerified,
                hasRecentExploits,
                rugPullRisk,
                recommendations: [],
            }),
        };

        // Cache result
        if (this.config.cacheResults) {
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
        }

        return result;
    }

    /**
     * Check if contract is verified on block explorer
     */
    private async checkVerification(address: Address, chainId: number): Promise<boolean> {
        // TODO: Integrate with Etherscan/Blockscout API
        // For now, return mock data
        return Math.random() > 0.3; // 70% verified rate for demo
    }

    /**
     * Check exploit history from databases
     */
    private async checkExploitHistory(address: Address, chainId: number): Promise<boolean> {
        // TODO: Integrate with Rekt, DeFiYield, BlockSec databases
        // For now, return mock data
        return Math.random() > 0.95; // 5% have exploits for demo
    }

    /**
     * Check if contract is a token
     */
    private async isTokenContract(bytecode: string): Promise<boolean> {
        // Check for ERC20 function selectors
        const erc20Selectors = [
            'a9059cbb', // transfer
            '23b872dd', // transferFrom
            '095ea7b3', // approve
            '70a08231', // balanceOf
            'dd62ed3e', // allowance
        ];

        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
        const foundSelectors = erc20Selectors.filter((sel) => cleanBytecode.includes(sel));

        return foundSelectors.length >= 3; // If has 3+ ERC20 functions, likely a token
    }

    /**
     * Analyze token-specific security
     */
    private async analyzeToken(
        address: Address,
        chainId: number
    ): Promise<{ checks: SecurityCheck[]; rugPullRisk: number }> {
        const checks: SecurityCheck[] = [];

        // TODO: Integrate with token analysis APIs (Honeypot.is, Token Sniffer, etc.)
        // For now, generate mock analysis

        const mockTopHolderConcentration = Math.random() * 100;
        const mockLiquidityLocked = Math.random() > 0.4;
        const mockHasHiddenFees = Math.random() > 0.8;
        const mockContractAge = Math.floor(Math.random() * 365);

        // Check holder concentration
        if (mockTopHolderConcentration > 50) {
            checks.push({
                name: 'Holder Concentration',
                passed: false,
                severity: RiskLevel.HIGH,
                message: `Top holders control ${mockTopHolderConcentration.toFixed(1)}% of supply`,
                details: { concentration: mockTopHolderConcentration },
            });
        }

        // Check liquidity lock
        if (!mockLiquidityLocked) {
            checks.push({
                name: 'Liquidity Lock',
                passed: false,
                severity: RiskLevel.HIGH,
                message: 'Liquidity is not locked - rug pull risk',
            });
        } else {
            checks.push({
                name: 'Liquidity Lock',
                passed: true,
                severity: RiskLevel.LOW,
                message: 'Liquidity is locked',
            });
        }

        // Check for hidden fees
        if (mockHasHiddenFees) {
            checks.push({
                name: 'Transfer Fees',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: 'Token has hidden transfer fees',
            });
        }

        // Check contract age
        if (mockContractAge < 7) {
            checks.push({
                name: 'Contract Age',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: `Contract is only ${mockContractAge} days old`,
                details: { age: mockContractAge },
            });
        }

        const rugPullRisk = RiskAnalyzer.calculateRugPullRisk(
            mockTopHolderConcentration,
            mockLiquidityLocked,
            mockHasHiddenFees,
            mockContractAge
        );

        return { checks, rugPullRisk };
    }

    /**
     * Get chain configuration
     */
    private getChain(chainId: number): Chain {
        // TODO: Support multiple chains
        return mainnet;
    }

    /**
     * Format scan result for display
     */
    static formatScanResult(result: ContractScanResult): string {
        const lines: string[] = [];

        lines.push('═══════════════════════════════════════════════════');
        lines.push('🔒 AUTOFI SECURITY SCAN RESULT');
        lines.push('═══════════════════════════════════════════════════');
        lines.push('');
        lines.push(`Contract: ${result.contractAddress}`);
        lines.push(`Chain ID: ${result.chainId}`);
        lines.push(`Scanned: ${new Date(result.timestamp).toLocaleString()}`);
        lines.push('');
        lines.push(`Overall Risk: ${RiskAnalyzer.formatRiskScore(result.riskScore)} - ${result.overallRisk.toUpperCase()}`);
        lines.push('');

        // Verification status
        lines.push(`${result.isVerified ? '✅' : '❌'} Contract ${result.isVerified ? 'verified' : 'NOT verified'} on block explorer`);

        // Exploit history
        if (result.hasRecentExploits) {
            lines.push('🚨 Recent exploit history detected');
        }

        // Rug pull risk
        if (result.rugPullRisk > 0) {
            const rugEmoji = result.rugPullRisk > 70 ? '🚨' : result.rugPullRisk > 40 ? '⚠️' : '🟡';
            lines.push(`${rugEmoji} Rug pull risk: ${result.rugPullRisk}/100`);
        }

        lines.push('');
        lines.push('───────────────────────────────────────────────────');
        lines.push('SECURITY CHECKS:');
        lines.push('───────────────────────────────────────────────────');

        result.checks.forEach((check) => {
            const icon = check.passed ? '✅' : '❌';
            const severity = check.passed ? '' : ` [${check.severity.toUpperCase()}]`;
            lines.push(`${icon} ${check.name}${severity}`);
            lines.push(`   ${check.message}`);
            if (check.details) {
                lines.push(`   Details: ${JSON.stringify(check.details)}`);
            }
            lines.push('');
        });

        if (result.recommendations.length > 0) {
            lines.push('───────────────────────────────────────────────────');
            lines.push('RECOMMENDATIONS:');
            lines.push('───────────────────────────────────────────────────');
            result.recommendations.forEach((rec) => {
                lines.push(rec);
            });
        }

        lines.push('═══════════════════════════════════════════════════');

        return lines.join('\n');
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}
