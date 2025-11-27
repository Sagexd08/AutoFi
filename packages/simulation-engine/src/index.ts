/**
 * @autofi/simulation-engine
 * 
 * Transaction simulation and explainable AI preview for Autofi
 * 
 * Features:
 * - Transaction simulation (Tenderly / Mock)
 * - Template-based explanation with rich context detection
 * - Visual diff generation
 * - Gas estimation
 */

export { Simulator } from './simulator';
export { Explainer } from './explainer';
export { VisualDiff } from './visual-diff';

export type {
    SimulationRequest,
    SimulationResult,
    SimulationExplanation,
    AssetChange,
    StateChange,
    SimulationConfig,
} from './types';
