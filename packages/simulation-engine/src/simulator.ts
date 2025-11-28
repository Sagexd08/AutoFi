import axios from 'axios';
import { formatUnits } from 'viem';
import {
    SimulationConfig,
    SimulationConfigSchema,
    SimulationRequest,
    SimulationResult,
    AssetChange,
    StateChange,
} from './types';
import { randomUUID } from 'crypto';

/**
 * Simulator - Executes transaction simulations
 */
export class Simulator {
    private config: SimulationConfig;

    constructor(config?: Partial<SimulationConfig>) {
        this.config = SimulationConfigSchema.parse(config || {});
    }

    /**
     * Simulate a transaction
     */
    async simulate(request: SimulationRequest): Promise<SimulationResult> {
        if (this.config.mockSimulation || !this.config.tenderlyApiKey) {
            return this.mockSimulate(request);
        }

        try {
            return await this.tenderlySimulate(request);
        } catch (error) {
            console.error('Tenderly simulation failed, falling back to mock:', error);
            return this.mockSimulate(request);
        }
    }

    /**
     * Simulate using Tenderly API
     */
    private async tenderlySimulate(request: SimulationRequest): Promise<SimulationResult> {
        const url = `https://api.tenderly.co/api/v1/account/${this.config.tenderlyAccountSlug}/project/${this.config.tenderlyProjectSlug}/simulate`;

        const response = await axios.post(
            url,
            {
                network_id: request.chainId.toString(),
                from: request.from,
                to: request.to,
                input: request.data || '0x',
                value: request.value || '0',
                gas: request.gasLimit ? parseInt(request.gasLimit) : 8000000,
                save: true,
            },
            {
                headers: {
                    'X-Access-Key': this.config.tenderlyApiKey,
                },
            }
        );

        const data = response.data;
        const transaction = data.transaction;

        // Parse asset changes from Tenderly response
        // Note: This is a simplified parsing logic. Real implementation would be more complex.
        const assetChanges: AssetChange[] = [];

        // Parse state changes
        const stateChanges: StateChange[] = [];

        return {
            id: data.simulation.id,
            success: transaction.status,
            timestamp: Date.now(),
            request,
            gasUsed: transaction.gas_used.toString(),
            gasPrice: '0', // Tenderly might not return this directly in sim
            estimatedCostUsd: 0, // Need external price feed
            assetChanges,
            stateChanges,
            logs: transaction.logs ? transaction.logs.map((l: any) => l.data) : [],
            error: transaction.error_message,
            revertReason: transaction.error_message,
            trace: transaction.call_trace,
        };
    }

    /**
     * Mock simulation for testing/demo
     */
    private async mockSimulate(request: SimulationRequest): Promise<SimulationResult> {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        const isSuccess = !request.data?.includes('dead'); // Fail if data contains 'dead' for testing
        const gasUsed = '125000';
        const gasPrice = '30000000000'; // 30 gwei
        const ethPrice = 2500;

        const costEth = (BigInt(gasUsed) * BigInt(gasPrice));
        const costUsd = parseFloat(formatUnits(costEth, 18)) * ethPrice;

        // Mock asset changes based on input
        const assetChanges: AssetChange[] = [];

        // If sending value, show ETH transfer
        if (request.value && request.value !== '0') {
            assetChanges.push({
                assetType: 'NATIVE',
                address: '0x0000000000000000000000000000000000000000',
                symbol: 'ETH',
                decimals: 18,
                from: request.from,
                to: request.to,
                amount: request.value,
                formattedAmount: formatUnits(BigInt(request.value), 18),
                valueUsd: parseFloat(formatUnits(BigInt(request.value), 18)) * ethPrice,
            });
        }

        // Mock a token swap if it looks like a swap (random heuristic for demo)
        if (request.data && request.data.length > 100) {
            // Outgoing USDC
            assetChanges.push({
                assetType: 'ERC20',
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                symbol: 'USDC',
                decimals: 6,
                from: request.from,
                to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Router
                amount: '1000000000', // 1000 USDC
                formattedAmount: '1,000.00',
                valueUsd: 1000,
            });

            // Incoming UNI
            assetChanges.push({
                assetType: 'ERC20',
                address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
                symbol: 'UNI',
                decimals: 18,
                from: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
                to: request.from,
                amount: '150000000000000000000', // 150 UNI
                formattedAmount: '150.00',
                valueUsd: 980, // Slight slippage
            });
        }

        return {
            id: randomUUID(),
            success: isSuccess,
            timestamp: Date.now(),
            request,
            gasUsed,
            gasPrice,
            estimatedCostUsd: costUsd,
            assetChanges,
            stateChanges: [],
            logs: [],
            error: isSuccess ? undefined : 'Execution reverted: Slippage tolerance exceeded',
            revertReason: isSuccess ? undefined : 'Slippage tolerance exceeded',
        };
    }
}
