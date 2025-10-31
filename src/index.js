/**
 * @module autofi
 * @description Advanced AI-powered blockchain automation system with LangChain integration
 */

/**
 * Main automation system for managing blockchain operations
 * @type {import('./automation-system.js').default}
 */
export { default as AutomationSystem } from "./automation-system.js";

/**
 * Service for interacting with Etherscan API
 * @type {import('./lib/etherscan-service.js').default}
 */
export { default as EtherscanService } from "./lib/etherscan-service.js";

/**
 * Service for estimating gas prices and optimizing transactions
 * @type {import('./lib/gas-estimation-service.js').default}
 */
export { default as GasEstimationService } from "./lib/gas-estimation-service.js";

/**
 * AI agent powered by LangChain for smart contract interactions
 * @type {import('./lib/langchain-agent.js').default}
 */
export { default as LangChainAgent } from "./lib/langchain-agent.js";

/**
 * Utility for tracking blockchain transactions and their states
 * @type {import('./lib/transaction-tracker.js').default}
 */
export { default as TransactionTracker } from "./lib/transaction-tracker.js";
