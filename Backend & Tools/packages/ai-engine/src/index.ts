// Autofi AI Engine
// Natural Language to On-chain Intent Parser

export { AIEngine, createAIEngine } from './ai-engine.js';
export { buildContextualSystemPrompt, AUTOFI_SYSTEM_PROMPT } from './prompts.js';
export {
  FUNCTION_REGISTRY,
  getFunctionCallJsonSchema,
  getFunctionDefinition,
  getFunctionsByCategory,
  getFunctionsForChain,
  buildFunctionRegistryDocs,
  validateFunctionCall,
  type FunctionDefinition,
} from './function-registry.js';
export * from './types.js';
export { PredictiveIntentAgent, type PredictiveIntentConfig, type PredictionContext, type PredictedIntent } from './predictive-intent.js';
