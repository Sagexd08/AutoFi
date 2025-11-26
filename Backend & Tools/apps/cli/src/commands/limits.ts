import axios from 'axios';
import type { Command } from 'commander';

const API_URL = process.env.CELO_AI_API_URL || 'http://localhost:3000';

export async function limitsCommand(options: any, command: Command) {
  const jsonOutput = options.json || false;

  try {
    if (options.set) {
      const agentId = options.agentId || command.args[0];
      const daily = options.daily || command.args[1];
      const perTx = options.perTx || command.args[2];

      if (!agentId || !daily || !perTx) {
        console.error('❌ Usage: limits set <agentId> <dailyLimit> <perTxLimit>');
        process.exit(1);
      }

      const response = await axios.post(`${API_URL}/api/limits`, {
        agentId,
        dailyLimit: daily,
        perTxLimit: perTx,
        currency: options.currency,
      });

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log(`✅ Limits set for agent ${agentId}:`);
        console.log(`   Daily: ${response.data.dailyLimit}`);
        console.log(`   Per Transaction: ${response.data.perTxLimit}`);
      }
    } else if (options.get) {
      const agentId = options.get || command.args[0];

      if (!agentId) {
        console.error('❌ Agent ID is required');
        process.exit(1);
      }

      const response = await axios.get(`${API_URL}/api/limits/${agentId}`);

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log(`📊 Limits for agent ${agentId}:`);
        console.log(`   Daily: ${response.data.dailyLimit}`);
        console.log(`   Per Transaction: ${response.data.perTxLimit}`);
      }
    } else {
      command.help();
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

