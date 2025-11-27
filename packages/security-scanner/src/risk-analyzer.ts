import { ContractScanResult, SecurityCheck, RiskLevel } from './types';

/**
 * Risk Analyzer - Calculates overall risk score and level
 */
export class RiskAnalyzer {
    /**
     * Calculate overall risk score from security checks
     */
    static calculateRiskScore(checks: SecurityCheck[]): number {
        if (checks.length === 0) return 0;

        const weights = {
            [RiskLevel.LOW]: 1,
            [RiskLevel.MEDIUM]: 2,
            [RiskLevel.HIGH]: 3,
            [RiskLevel.CRITICAL]: 4,
        };

        let totalWeight = 0;
        let failedWeight = 0;

        checks.forEach((check) => {
            const weight = weights[check.severity];
            totalWeight += weight;
            if (!check.passed) {
                failedWeight += weight;
            }
        });

        return totalWeight > 0 ? Math.round((failedWeight / totalWeight) * 100) : 0;
    }

    /**
     * Determine risk level from risk score
     */
    static getRiskLevel(riskScore: number): RiskLevel {
        if (riskScore >= 75) return RiskLevel.CRITICAL;
        if (riskScore >= 50) return RiskLevel.HIGH;
        if (riskScore >= 25) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    /**
     * Generate recommendations based on scan results
     */
    static generateRecommendations(result: ContractScanResult): string[] {
        const recommendations: string[] = [];

        if (!result.isVerified) {
            recommendations.push(
                '⚠️ Contract is not verified. Proceed with extreme caution.'
            );
        }

        if (result.hasRecentExploits) {
            recommendations.push(
                '🚨 This protocol has recent exploit history. Consider alternatives.'
            );
        }

        if (result.rugPullRisk > 70) {
            recommendations.push(
                '🚨 High rug pull risk detected. Token concentration or liquidity issues found.'
            );
        } else if (result.rugPullRisk > 40) {
            recommendations.push(
                '⚠️ Moderate rug pull risk. Review token distribution and liquidity locks.'
            );
        }

        const criticalChecks = result.checks.filter(
            (c) => !c.passed && c.severity === RiskLevel.CRITICAL
        );
        if (criticalChecks.length > 0) {
            recommendations.push(
                `🚨 ${criticalChecks.length} critical security issue(s) found. Do not proceed.`
            );
        }

        const highChecks = result.checks.filter(
            (c) => !c.passed && c.severity === RiskLevel.HIGH
        );
        if (highChecks.length > 0) {
            recommendations.push(
                `⚠️ ${highChecks.length} high-severity issue(s) found. Review carefully before proceeding.`
            );
        }

        if (result.overallRisk === RiskLevel.LOW && result.isVerified) {
            recommendations.push(
                '✅ Contract appears safe based on automated checks. Always do your own research.'
            );
        }

        return recommendations;
    }

    /**
     * Calculate rug pull risk score
     */
    static calculateRugPullRisk(
        topHolderConcentration: number,
        liquidityLocked: boolean,
        hasHiddenFees: boolean,
        contractAge: number // in days
    ): number {
        let risk = 0;

        // Top holder concentration (0-40 points)
        if (topHolderConcentration > 50) {
            risk += 40;
        } else if (topHolderConcentration > 30) {
            risk += 25;
        } else if (topHolderConcentration > 20) {
            risk += 15;
        }

        // Liquidity lock (0-30 points)
        if (!liquidityLocked) {
            risk += 30;
        }

        // Hidden fees (0-20 points)
        if (hasHiddenFees) {
            risk += 20;
        }

        // Contract age (0-10 points)
        if (contractAge < 7) {
            risk += 10;
        } else if (contractAge < 30) {
            risk += 5;
        }

        return Math.min(risk, 100);
    }

    /**
     * Analyze token holder distribution
     */
    static analyzeHolderDistribution(
        holders: Array<{ address: string; balance: string }>,
        totalSupply: string
    ): number {
        if (holders.length === 0) return 100; // Maximum risk if no data

        const totalSupplyBigInt = BigInt(totalSupply);
        const top10Holders = holders.slice(0, 10);

        let top10Balance = BigInt(0);
        for (const holder of top10Holders) {
            top10Balance += BigInt(holder.balance);
        }

        const concentration = Number((top10Balance * BigInt(10000)) / totalSupplyBigInt) / 100;
        return Math.min(concentration, 100);
    }

    /**
     * Check if contract has suspicious patterns
     */
    static detectSuspiciousPatterns(bytecode: string): SecurityCheck[] {
        const checks: SecurityCheck[] = [];

        // Check for selfdestruct
        if (bytecode.includes('ff')) {
            checks.push({
                name: 'Selfdestruct Detection',
                passed: false,
                severity: RiskLevel.HIGH,
                message: 'Contract contains selfdestruct opcode',
                details: { opcode: 'SELFDESTRUCT (0xff)' },
            });
        }

        // Check for delegatecall (can be dangerous)
        if (bytecode.includes('f4')) {
            checks.push({
                name: 'Delegatecall Detection',
                passed: false,
                severity: RiskLevel.MEDIUM,
                message: 'Contract uses delegatecall - verify it is used safely',
                details: { opcode: 'DELEGATECALL (0xf4)' },
            });
        }

        // Check for unusual storage patterns
        const storageOps = (bytecode.match(/55/g) || []).length; // SSTORE
        if (storageOps > 100) {
            checks.push({
                name: 'Storage Pattern Analysis',
                passed: false,
                severity: RiskLevel.LOW,
                message: 'High number of storage operations detected',
                details: { count: storageOps },
            });
        }

        return checks;
    }

    /**
     * Format risk score for display
     */
    static formatRiskScore(score: number): string {
        const emoji = score >= 75 ? '🔴' : score >= 50 ? '🟠' : score >= 25 ? '🟡' : '🟢';
        return `${emoji} ${score}/100`;
    }

    /**
     * Get color code for risk level
     */
    static getRiskColor(level: RiskLevel): string {
        const colors = {
            [RiskLevel.LOW]: '#22c55e',
            [RiskLevel.MEDIUM]: '#eab308',
            [RiskLevel.HIGH]: '#f97316',
            [RiskLevel.CRITICAL]: '#ef4444',
        };
        return colors[level];
    }
}
