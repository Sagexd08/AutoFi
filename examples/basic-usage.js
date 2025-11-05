import {
  AutomationSystem,
  EtherscanService,
  GasEstimationService,
  LangChainAgent,
  TransactionTracker,
} from "../src/index.js";

// Initialize services
const etherscanService = new EtherscanService({
  apiKey: "YOUR_ETHERSCAN_API_KEY",
});

const gasEstimation = new GasEstimationService();
const transactionTracker = new TransactionTracker();

// Initialize AI agent
let agent;

// Create automation system
const automation = new AutomationSystem({
  etherscanService,
  gasEstimation,
  transactionTracker,
  agent: null, // Will be set after async initialization
});

// Example usage
async function main() {
  try {
    // Initialize agent with async factory method
    agent = await LangChainAgent.create({
      apiKey: "YOUR_API_KEY",
    });
    
    // Set agent on automation system
    automation.agent = agent;

    // Start monitoring transactions
    await automation.start();

    // Use the agent to analyze a smart contract
    const contractAddress = "0x...";
    const analysis = await agent.analyzeContract(contractAddress);
    console.log("Contract Analysis:", analysis);

    // Estimate gas for a transaction
    const gasPrice = await gasEstimation.estimateGas({
      to: contractAddress,
      data: "0x...",
    });
    console.log("Estimated Gas Price:", gasPrice);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
