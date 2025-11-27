import { z } from 'zod';
import { Address } from 'viem';

/**
 * Simulation request parameters
 */
export interface SimulationRequest {
    chainId: number;
    from: Address;
    to: Address;
    value?: string; // BigInt as string
    data?: string;
    gasLimit?: string;
    blockNumber?: number; // Optional: simulate at specific block
}

/**
 * Asset change detected in simulation
 */
export interface AssetChange {
    assetType: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155';
    address: Address; // Token address or 0x0 for native
    symbol: string;
    decimals: number;
    from: Address;
    to: Address;
    amount: string;
    formattedAmount: string;
    logoUrl?: string;
    valueUsd?: number;
}

/**
 * State change (approval, ownership, etc.)
 */
export interface StateChange {
    type: 'APPROVAL' | 'OWNERSHIP_TRANSFER' | 'PAUSE' | 'BLACKLIST' | 'OTHER';
    contract: Address;
    description: string;
    details: Record<string, any>;
}

/**
 * Simulation result
 */
export interface SimulationResult {
    id: string;
    success: boolean;
    timestamp: number;
    request: SimulationRequest;
    gasUsed: string;
    gasPrice: string;
    estimatedCostUsd: number;
    assetChanges: AssetChange[];
    stateChanges: StateChange[];
    logs: string[];
    error?: string;
    revertReason?: string;
    trace?: any[]; // Full call trace
}

/**
 * Natural language explanation
 */
export interface SimulationExplanation {
    summary: string; // One sentence summary
    steps: string[]; // Step-by-step breakdown
    riskFactors: string[]; // Specific risks in this transaction
    financialImpact: {
        totalValueSentUsd: number;
        totalValueReceivedUsd: number;
        netImpactUsd: number;
        gasCostUsd: number;
    };
    confidenceScore: number; // 0-100
}

/**
 * Configuration for simulation engine
 */
export const SimulationConfigSchema = z.object({
    tenderlyApiKey: z.string().optional(),
    tenderlyAccountSlug: z.string().optional(),
    tenderlyProjectSlug: z.string().optional(),
    enableDetailedExplanation: z.boolean().default(true),
    mockSimulation: z.boolean().default(false), // For testing without API keys
});

export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
