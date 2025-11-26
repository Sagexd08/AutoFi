import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import('./Backend/automation-system.js').then(async (module) => {
  const AutomationSystem = module.default;
  
  console.log('🚀 Starting Celo AI Automation Engine...');
  console.log('📍 Root directory:', __dirname);
  
  const config = {
    port: process.env.PORT || 3001,
    geminiApiKey: process.env.GEMINI_API_KEY || 'AIzaSyCKFLkomLb78CSBz4FA36VS9Vb789fZ8qc',
    privateKey: process.env.PRIVATE_KEY,
    network: process.env.NETWORK || 'alfajores',
    rpcUrl: process.env.RPC_URL,
    alchemyApiKey: process.env.ALCHEMY_API_KEY,
    alchemyPolicyId: process.env.ALCHEMY_POLICY_ID,
    enableBlockchainIntegration: process.env.ENABLE_BLOCKCHAIN_INTEGRATION !== 'false',
    enableRealBlockchainCalls: process.env.ENABLE_REAL_BLOCKCHAIN_CALLS !== 'false',
    maxRiskScore: parseInt(process.env.MAX_RISK_SCORE) || 50,
    requireApproval: process.env.REQUIRE_APPROVAL === 'true',
    enableSimulation: process.env.ENABLE_SIMULATION === 'true',
    enableGasOptimization: process.env.ENABLE_GAS_OPTIMIZATION === 'true'
  };

  const automation = new AutomationSystem(config);
  automation.start();

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await automation.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    await automation.shutdown();
    process.exit(0);
  });

}).catch((error) => {
  console.error('❌ Failed to start automation system:', error);
  process.exit(1);
});