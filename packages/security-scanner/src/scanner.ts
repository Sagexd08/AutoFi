import { createPublicClient, http, Address, Chain } from 'viem';
import { mainnet, celo, celoAlfajores } from 'viem/chains';
import {
    ContractScanResult,
    SecurityCheck,
    RiskLevel,
    SecurityScannerConfig,
    SecurityScannerConfigSchema,
} from './types';
import { RiskAnalyzer } from './risk-analyzer';
import { BytecodeAnalyzer } from './bytecode-analyzer';

// API Configuration
interface APIConfig {
  goPlusApiKey?: string;
  etherscanApiKey?: string;  // Etherscan V2 API key (supports all chains including Celo)
}

/**
 * Main Security Scanner - Orchestrates all security checks
 * Uses real APIs: GoPlus Security, Etherscan/Celoscan for verification
 */
export class SecurityScanner {
    private config: SecurityScannerConfig;
    private apiConfig: APIConfig;
    private cache: Map<string, { result: ContractScanResult; timestamp: number }>;

    constructor(config?: Partial<SecurityScannerConfig>, apiConfig?: APIConfig) {
        this.config = SecurityScannerConfigSchema.parse(config || {});
        this.apiConfig = apiConfig || {
            goPlusApiKey: process.env.GOPLUS_API_KEY,
            etherscanApiKey: process.env.ETHERSCAN_API_KEY,  // Etherscan V2 supports all chains
        };
        this.cache = new Map();
    }

    /**
     * Scan a contract for security issues using real APIs
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

        // 3. Check verification using real APIs (Etherscan/Celoscan)
        const isVerified = await this.checkVerification(contractAddress, chainId);
        checks.push({
            name: 'Contract Verification',
            passed: isVerified,
            severity: isVerified ? RiskLevel.LOW : RiskLevel.HIGH,
            message: isVerified
                ? 'Contract is verified on block explorer'
                : 'Contract is NOT verified - source code unavailable',
        });

        // 4. Check for security issues using GoPlus API
        const goPlusResult = await this.checkGoPlusSecurity(contractAddress, chainId);
        if (goPlusResult) {
            checks.push(...goPlusResult.checks);
        }

        // 5. Check for recent exploits
        const hasRecentExploits = await this.checkExploitHistory(contractAddress, chainId);
        if (hasRecentExploits) {
            checks.push({
                name: 'Exploit History',
                passed: false,
                severity: RiskLevel.CRITICAL,
                message: 'This protocol has recent exploit history',
            });
        }

        // 6. Token-specific checks (if it's a token contract)
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
     * Check contract verification using Etherscan V2 API (supports all chains)
     */
    private async checkVerification(address: Address, chainId: number): Promise<boolean> {
        const apiKey = this.apiConfig.etherscanApiKey;
        
        if (!apiKey) {
            console.warn(`No Etherscan API key, skipping verification check`);
            return false; // Conservative: assume not verified if we can't check
        }

        try {
            // Etherscan V2 API uses chainid parameter for all chains
            const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json() as { status: string; message: string; result: string };
            
            // status "1" means verified (ABI was found)
            return data.status === '1' && data.result !== 'Contract source code not verified';
        } catch (error) {
            console.error('Verification check failed:', error);
            return false; // Conservative: assume not verified on error
        }
    }

    /**
     * Check security using GoPlus Security API
     */
    private async checkGoPlusSecurity(
        address: Address, 
        chainId: number
    ): Promise<{ checks: SecurityCheck[] } | null> {
        const checks: SecurityCheck[] = [];
        
        // GoPlus API endpoint
        const goPlusChainId = this.getGoPlusChainId(chainId);
        if (!goPlusChainId) {
            return null;
        }

        try {
            const url = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${address}`;
            const response = await fetch(url, {
                headers: this.apiConfig.goPlusApiKey 
                    ? { 'Authorization': `Bearer ${this.apiConfig.goPlusApiKey}` }
                    : {},
            });
            const data = await response.json() as { code: number; result: Record<string, any> };

            if (data.code !== 1 || !data.result[address.toLowerCase()]) {
                return null;
            }

            const result = data.result[address.toLowerCase()];

            // Check for honeypot
            if (result.is_honeypot === '1') {
                checks.push({
                    name: 'Honeypot Detection',
                    passed: false,
                    severity: RiskLevel.CRITICAL,
                    message: '🚨 This token is a HONEYPOT - you cannot sell it!',
                    details: { honeypot_with_same_creator: result.honeypot_with_same_creator },
                });
            } else if (result.is_honeypot === '0') {
                checks.push({
                    name: 'Honeypot Detection',
                    passed: true,
                    severity: RiskLevel.LOW,
                    message: 'Token is not a honeypot',
                });
            }

            // Check for hidden owner
            if (result.hidden_owner === '1') {
                checks.push({
                    name: 'Hidden Owner',
                    passed: false,
                    severity: RiskLevel.HIGH,
                    message: 'Contract has a hidden owner that can modify behavior',
                });
            }

            // Check for proxy contract
            if (result.is_proxy === '1') {
                checks.push({
                    name: 'Proxy Contract',
                    passed: true,
                    severity: RiskLevel.MEDIUM,
                    message: 'Contract is upgradeable (proxy pattern detected)',
                    details: { can_be_upgraded: true },
                });
            }

            // Check for mint function
            if (result.is_mintable === '1') {
                checks.push({
                    name: 'Mintable Token',
                    passed: false,
                    severity: RiskLevel.MEDIUM,
                    message: 'Token supply can be increased (mintable)',
                });
            }

            // Check for blacklist function
            if (result.is_blacklisted === '1' || result.can_take_back_ownership === '1') {
                checks.push({
                    name: 'Blacklist Capability',
                    passed: false,
                    severity: RiskLevel.HIGH,
                    message: 'Contract can blacklist addresses from trading',
                });
            }

            // Check transfer tax
            const buyTax = parseFloat(result.buy_tax || '0');
            const sellTax = parseFloat(result.sell_tax || '0');
            if (buyTax > 0 || sellTax > 0) {
                const maxTax = Math.max(buyTax, sellTax);
                checks.push({
                    name: 'Transfer Tax',
                    passed: maxTax < 10,
                    severity: maxTax > 20 ? RiskLevel.CRITICAL : maxTax > 10 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
                    message: `Buy tax: ${(buyTax * 100).toFixed(1)}%, Sell tax: ${(sellTax * 100).toFixed(1)}%`,
                    details: { buyTax, sellTax },
                });
            }

            // Check holder concentration
            if (result.holder_count) {
                const holderCount = parseInt(result.holder_count);
                checks.push({
                    name: 'Holder Distribution',
                    passed: holderCount > 100,
                    severity: holderCount < 50 ? RiskLevel.HIGH : holderCount < 100 ? RiskLevel.MEDIUM : RiskLevel.LOW,
                    message: `Token has ${holderCount} holders`,
                    details: { holderCount },
                });
            }

            // Check if LP is locked
            if (result.lp_holders && Array.isArray(result.lp_holders)) {
                const lpInfo = result.lp_holders;
                const isLpLocked = lpInfo.some((lp: any) => lp.is_locked === 1);
                checks.push({
                    name: 'Liquidity Lock',
                    passed: isLpLocked,
                    severity: isLpLocked ? RiskLevel.LOW : RiskLevel.HIGH,
                    message: isLpLocked ? 'Liquidity is locked' : 'Liquidity is NOT locked - rug pull risk',
                    details: { lpHolders: lpInfo },
                });
            }

            return { checks };
        } catch (error) {
            console.error('GoPlus API check failed:', error);
            return null;
        }
    }

    /**
     * Check exploit history from known databases
     */
    private async checkExploitHistory(_address: Address, _chainId: number): Promise<boolean> {
        // Known exploited protocols (would be expanded with a real database)
        const knownExploits = new Set<string>([
            // Add known exploited contract addresses here (lowercase)
        ]);

        return knownExploits.has(_address.toLowerCase() as string);
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
     * Analyze token-specific security using GoPlus API
     */
    private async analyzeToken(
        address: Address,
        chainId: number
    ): Promise<{ checks: SecurityCheck[]; rugPullRisk: number }> {
        const checks: SecurityCheck[] = [];
        
        // Try to get token analysis from GoPlus
        const goPlusChainId = this.getGoPlusChainId(chainId);
        if (!goPlusChainId) {
            return { checks, rugPullRisk: 50 }; // Unknown risk without API
        }

        try {
            const url = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${address}`;
            const response = await fetch(url, {
                headers: this.apiConfig.goPlusApiKey 
                    ? { 'Authorization': `Bearer ${this.apiConfig.goPlusApiKey}` }
                    : {},
            });
            const data = await response.json() as { code: number; result: Record<string, any> };

            if (data.code !== 1 || !data.result[address.toLowerCase()]) {
                return { checks, rugPullRisk: 50 };
            }

            const result = data.result[address.toLowerCase()];

            // Calculate rug pull risk based on real data
            let rugPullRisk = 0;

            // Honeypot = instant 100%
            if (result.is_honeypot === '1') {
                rugPullRisk = 100;
            } else {
                // Add risk based on various factors
                if (result.hidden_owner === '1') rugPullRisk += 25;
                if (result.can_take_back_ownership === '1') rugPullRisk += 20;
                if (result.is_mintable === '1') rugPullRisk += 15;
                if (result.is_blacklisted === '1') rugPullRisk += 15;
                
                // High sell tax
                const sellTax = parseFloat(result.sell_tax || '0');
                if (sellTax > 0.2) rugPullRisk += 25;
                else if (sellTax > 0.1) rugPullRisk += 15;
                
                // LP not locked
                const lpLocked = result.lp_holders?.some((lp: any) => lp.is_locked === 1);
                if (!lpLocked) rugPullRisk += 20;
                
                // Low holder count
                const holderCount = parseInt(result.holder_count || '0');
                if (holderCount < 50) rugPullRisk += 15;
                else if (holderCount < 100) rugPullRisk += 10;
            }

            rugPullRisk = Math.min(rugPullRisk, 100);

            return { checks, rugPullRisk };
        } catch (error) {
            console.error('Token analysis failed:', error);
            return { checks, rugPullRisk: 50 }; // Unknown risk on error
        }
    }

    /**
     * Get GoPlus chain ID mapping
     */
    private getGoPlusChainId(chainId: number): string | undefined {
        const mapping: Record<number, string> = {
            1: '1',        // Ethereum
            56: '56',      // BSC
            137: '137',    // Polygon
            42161: '42161', // Arbitrum
            10: '10',      // Optimism
            42220: '42220', // Celo
            44787: '44787', // Celo Alfajores (may not be supported)
        };
        return mapping[chainId];
    }

    /**
     * Get chain configuration
     */
    private getChain(chainId: number): Chain {
        switch (chainId) {
            case 42220: return celo;
            case 44787: return celoAlfajores;
            default: return mainnet;
        }
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
