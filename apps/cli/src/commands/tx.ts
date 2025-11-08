import axios from 'axios';
import type { Command } from 'commander';

const API_URL = process.env.CELO_AI_API_URL || 'http://localhost:3000';

export async function txCommand(options: any, command: Command) {
  const jsonOutput = options.json || false;

  try {
    if (options.send) {
      const response = await axios.post(`${API_URL}/api/tx/send`, {
        to: options.to,
        value: options.value,
        data: options.data,
        agentId: options.agentId,
        simulateOnly: options.simulate || false,
      });

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log(`✅ Transaction sent: ${response.data.transactionHash}`);
        console.log(`   Risk Score: ${response.data.riskScore}`);
        if (response.data.requiresApproval) {
          console.log('   ⚠️  Requires approval');
        }
      }
    } else if (options.estimate) {
      const response = await axios.post(`${API_URL}/api/tx/estimate`, {
        to: options.to,
        value: options.value,
        data: options.data,
      });

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('⛽ Gas Estimate:');
        console.log(`   Gas Limit: ${response.data.gasLimit}`);
        console.log(`   Gas Price: ${response.data.gasPrice}`);
      }
    } else {
      command.help();
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

