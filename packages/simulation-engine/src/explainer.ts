import {
    SimulationResult,
    SimulationExplanation,
    SimulationConfig,
    SimulationConfigSchema,
} from './types';

/**
 * Known contract addresses for better explanations
 */
const KNOWN_CONTRACTS: Record<string, string> = {
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
    '0x881d40237659c251811cec9c364ef91dc08d300c': 'Metamask Swap Router',
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
    '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3 Pool',
    '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave V2 Pool',
    '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido stETH',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
};

/**
 * AI Explainer - Generates natural language explanations for transactions
 * 
 * Uses template-based explanation generation without external LLM providers
 */
export class Explainer {
    constructor(config?: Partial<SimulationConfig>) {
        // Config validated but not stored - all logic is template-based
        SimulationConfigSchema.parse(config || {});
    }

    /**
     * Explain a simulation result
     */
    async explain(result: SimulationResult): Promise<SimulationExplanation> {
        return this.generateExplanation(result);
    }

    /**
     * Get known contract name
     */
    private getContractName(address: string): string | null {
        return KNOWN_CONTRACTS[address.toLowerCase()] || null;
    }

    /**
     * Detect transaction type from asset changes
     */
    private detectTransactionType(result: SimulationResult): string {
        const outgoing = result.assetChanges.filter(a => a.from === result.request.from);
        const incoming = result.assetChanges.filter(a => a.to === result.request.from);

        if (outgoing.length > 0 && incoming.length > 0) {
            // Check for same tokens (could be LP add/remove)
            const outSymbols = new Set(outgoing.map(a => a.symbol));
            const inSymbols = new Set(incoming.map(a => a.symbol));
            
            if (outSymbols.size === 2 && inSymbols.size === 1) {
                return 'add_liquidity';
            }
            if (outSymbols.size === 1 && inSymbols.size === 2) {
                return 'remove_liquidity';
            }
            return 'swap';
        } else if (outgoing.length > 0 && incoming.length === 0) {
            // Check if it's to a known staking contract
            const toAddress = outgoing[0]?.to?.toLowerCase();
            if (toAddress && KNOWN_CONTRACTS[toAddress]?.includes('stETH')) {
                return 'stake';
            }
            return 'send';
        } else if (incoming.length > 0 && outgoing.length === 0) {
            return 'receive';
        }

        // Check for approval
        if (result.stateChanges.some(s => s.type === 'APPROVAL')) {
            return 'approve';
        }

        return 'contract_interaction';
    }

    /**
     * Generate explanation using templates
     */
    private generateExplanation(result: SimulationResult): SimulationExplanation {
        const steps: string[] = [];
        const riskFactors: string[] = [];
        let totalValueSentUsd = 0;
        let totalValueReceivedUsd = 0;

        // Analyze asset changes
        const outgoing = result.assetChanges.filter(a => a.from === result.request.from);
        const incoming = result.assetChanges.filter(a => a.to === result.request.from);

        const txType = this.detectTransactionType(result);
        const targetContract = this.getContractName(result.request.to);

        // Generate contextual steps based on transaction type
        switch (txType) {
            case 'swap': {
                const sent = outgoing.map(a => `${a.formattedAmount} ${a.symbol}`).join(' + ');
                const received = incoming.map(a => `${a.formattedAmount} ${a.symbol}`).join(' + ');
                const protocol = targetContract || 'DEX';
                
                steps.push(`🔄 Swap ${sent} for ${received} using ${protocol}`);
                
                // Calculate exchange rate
                if (outgoing.length === 1 && incoming.length === 1) {
                    const rate = parseFloat(incoming[0].formattedAmount) / parseFloat(outgoing[0].formattedAmount);
                    steps.push(`📊 Exchange rate: 1 ${outgoing[0].symbol} = ${rate.toFixed(6)} ${incoming[0].symbol}`);
                }
                break;
            }

            case 'stake': {
                outgoing.forEach(a => {
                    steps.push(`🥩 Stake ${a.formattedAmount} ${a.symbol}`);
                });
                if (incoming.length > 0) {
                    incoming.forEach(a => {
                        steps.push(`📜 Receive ${a.formattedAmount} ${a.symbol} (staking receipt)`);
                    });
                }
                break;
            }

            case 'add_liquidity': {
                const tokens = outgoing.map(a => `${a.formattedAmount} ${a.symbol}`).join(' + ');
                steps.push(`💧 Add liquidity: ${tokens}`);
                if (incoming.length > 0) {
                    steps.push(`📜 Receive LP tokens: ${incoming.map(a => `${a.formattedAmount} ${a.symbol}`).join(', ')}`);
                }
                break;
            }

            case 'remove_liquidity': {
                steps.push(`💧 Remove liquidity: ${outgoing.map(a => a.symbol).join('/')}`);
                const tokens = incoming.map(a => `${a.formattedAmount} ${a.symbol}`).join(' + ');
                steps.push(`📥 Receive: ${tokens}`);
                break;
            }

            case 'send': {
                outgoing.forEach(a => {
                    const recipient = a.to.slice(0, 6) + '...' + a.to.slice(-4);
                    steps.push(`📤 Send ${a.formattedAmount} ${a.symbol} to ${recipient}`);
                });
                break;
            }

            case 'receive': {
                incoming.forEach(a => {
                    steps.push(`📥 Receive ${a.formattedAmount} ${a.symbol}`);
                });
                break;
            }

            case 'approve': {
                const approvalChange = result.stateChanges.find(s => s.type === 'APPROVAL');
                if (approvalChange) {
                    const spenderAddr = approvalChange.details?.spender as string || '';
                    const spender = this.getContractName(spenderAddr) || 
                                   (spenderAddr ? spenderAddr.slice(0, 10) + '...' : 'unknown');
                    steps.push(`✅ Approve ${spender} to spend your tokens`);
                }
                break;
            }

            default: {
                if (targetContract) {
                    steps.push(`📝 Interact with ${targetContract}`);
                } else {
                    steps.push(`📝 Execute contract interaction`);
                }
            }
        }

        // Calculate financials
        outgoing.forEach(a => { totalValueSentUsd += a.valueUsd || 0; });
        incoming.forEach(a => { totalValueReceivedUsd += a.valueUsd || 0; });

        // Add gas cost step
        steps.push(`⛽ Pay estimated gas fee of $${result.estimatedCostUsd.toFixed(2)} (${result.gasUsed} gas)`);

        // Identify risks with severity
        if (!result.success) {
            riskFactors.push('🚨 CRITICAL: Transaction is expected to FAIL/REVERT');
        }

        if (result.estimatedCostUsd > 100) {
            riskFactors.push(`⚠️ Very high gas cost ($${result.estimatedCostUsd.toFixed(2)})`);
        } else if (result.estimatedCostUsd > 50) {
            riskFactors.push(`⚠️ High gas cost ($${result.estimatedCostUsd.toFixed(2)})`);
        }

        // Check slippage
        if (totalValueSentUsd > 0 && totalValueReceivedUsd > 0) {
            const slippage = (totalValueSentUsd - totalValueReceivedUsd) / totalValueSentUsd;
            if (slippage > 0.05) {
                riskFactors.push(`⚠️ High slippage detected (~${(slippage * 100).toFixed(1)}%)`);
            } else if (slippage > 0.02) {
                riskFactors.push(`ℹ️ Moderate slippage (~${(slippage * 100).toFixed(1)}%)`);
            }
        }

        // Check for unlimited approvals
        const unlimitedApproval = result.stateChanges.find(
            s => s.type === 'APPROVAL' && 
            s.details?.amount === 'unlimited'
        );
        if (unlimitedApproval) {
            riskFactors.push('⚠️ Unlimited token approval requested');
        }

        // Check for large value transfers
        if (totalValueSentUsd > 10000) {
            riskFactors.push(`ℹ️ Large value transfer ($${totalValueSentUsd.toFixed(2)})`);
        }

        // Check for unknown contracts
        if (!targetContract && result.request.to) {
            riskFactors.push('ℹ️ Interacting with unverified/unknown contract');
        }

        // Generate summary
        let summary = this.generateSummary(txType, result, outgoing, incoming, targetContract);

        // Calculate confidence based on how well we understood the transaction
        let confidenceScore = 90;
        if (!targetContract) confidenceScore -= 10;
        if (txType === 'contract_interaction') confidenceScore -= 15;
        if (!result.success) confidenceScore -= 20;

        return {
            summary,
            steps,
            riskFactors,
            financialImpact: {
                totalValueSentUsd,
                totalValueReceivedUsd,
                netImpactUsd: totalValueReceivedUsd - totalValueSentUsd - result.estimatedCostUsd,
                gasCostUsd: result.estimatedCostUsd,
            },
            confidenceScore: Math.max(confidenceScore, 50),
        };
    }

    /**
     * Generate a summary based on transaction type
     */
    private generateSummary(
        txType: string,
        result: SimulationResult,
        outgoing: SimulationResult['assetChanges'],
        incoming: SimulationResult['assetChanges'],
        protocol: string | null
    ): string {
        if (!result.success) {
            return '⚠️ This transaction will FAIL. Do not execute.';
        }

        const protocolName = protocol || 'DeFi protocol';

        switch (txType) {
            case 'swap':
                if (outgoing.length > 0 && incoming.length > 0) {
                    return `Swap ${outgoing[0].symbol} for ${incoming[0].symbol} on ${protocolName}`;
                }
                return `Token swap on ${protocolName}`;

            case 'stake':
                return `Stake ${outgoing[0]?.symbol || 'tokens'} ${protocol ? `on ${protocol}` : ''}`;

            case 'add_liquidity':
                return `Add liquidity to ${outgoing.map(a => a.symbol).join('/')} pool`;

            case 'remove_liquidity':
                return `Remove liquidity from ${incoming.map(a => a.symbol).join('/')} pool`;

            case 'send':
                return `Send ${outgoing[0]?.symbol || 'tokens'} to external address`;

            case 'receive':
                return `Receive ${incoming[0]?.symbol || 'tokens'}`;

            case 'approve':
                return `Approve token spending for ${protocolName}`;

            default:
                return `Execute transaction on ${protocolName}`;
        }
    }
}
