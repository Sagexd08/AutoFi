import { SimulationResult } from './types';

/**
 * Visual Diff - Generates before/after comparison data
 */
export class VisualDiff {
    /**
     * Generate diff from simulation result
     */
    static generateDiff(result: SimulationResult): {
        balances: {
            asset: string;
            symbol: string;
            before: string;
            after: string;
            change: string;
            isPositive: boolean;
        }[];
        approvals: {
            token: string;
            spender: string;
            amount: string;
            isRevocation: boolean;
        }[];
    } {
        const balances: any[] = [];
        const approvals: any[] = [];

        // Process asset changes to calculate balance diffs
        // Note: In a real implementation, we would fetch actual "before" balances
        // For now, we calculate relative changes

        const assetMap = new Map<string, { symbol: string; change: number; decimals: number }>();

        result.assetChanges.forEach(change => {
            // Outgoing
            if (change.from === result.request.from) {
                const key = `${change.address}-${change.symbol}`;
                const current = assetMap.get(key) || { symbol: change.symbol, change: 0, decimals: change.decimals };
                current.change -= parseFloat(change.formattedAmount);
                assetMap.set(key, current);
            }

            // Incoming
            if (change.to === result.request.from) {
                const key = `${change.address}-${change.symbol}`;
                const current = assetMap.get(key) || { symbol: change.symbol, change: 0, decimals: change.decimals };
                current.change += parseFloat(change.formattedAmount);
                assetMap.set(key, current);
            }
        });

        assetMap.forEach((data, key) => {
            balances.push({
                asset: key.split('-')[0],
                symbol: data.symbol,
                before: 'Current',
                after: 'New',
                change: `${data.change > 0 ? '+' : ''}${data.change.toFixed(4)}`,
                isPositive: data.change >= 0,
            });
        });

        result.stateChanges.forEach(change => {
            if (change.type === 'APPROVAL') {
                approvals.push({
                    token: change.contract,
                    spender: change.details.spender,
                    amount: change.details.amount,
                    isRevocation: change.details.amount === '0',
                });
            }
        });

        return { balances, approvals };
    }

    /**
     * Format diff for display
     */
    static formatDiff(diff: ReturnType<typeof VisualDiff.generateDiff>): string {
        const lines: string[] = [];

        if (diff.balances.length > 0) {
            lines.push('💰 BALANCE CHANGES:');
            diff.balances.forEach(b => {
                const icon = b.isPositive ? '📈' : '📉';
                const color = b.isPositive ? '+' : '';
                lines.push(`${icon} ${b.symbol}: ${color}${b.change}`);
            });
        }

        if (diff.approvals.length > 0) {
            lines.push('\n🔐 APPROVALS:');
            diff.approvals.forEach(a => {
                if (a.isRevocation) {
                    lines.push(`❌ Revoke approval for ${a.token}`);
                } else {
                    lines.push(`✅ Approve ${a.amount} for ${a.token}`);
                }
            });
        }

        return lines.join('\n');
    }
}
