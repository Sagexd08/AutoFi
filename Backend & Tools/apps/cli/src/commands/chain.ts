import axios from 'axios';
import type { Command } from 'commander';

const API_URL = process.env.CELO_AI_API_URL || 'http://localhost:3000';

export async function chainCommand(options: any, command: Command) {
  const jsonOutput = options.json || false;

  try {
    if (options.health) {
      const chainId = options.chainId;
      const url = chainId
        ? `${API_URL}/api/chains/${chainId}/health`
        : `${API_URL}/api/chains/health`;

      const response = await axios.get(url);

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('🏥 Chain Health:');
        if (response.data.chainStatus) {
          Object.entries(response.data.chainStatus).forEach(([chain, status]: [string, any]) => {
            const statusIcon = status.healthy ? '✅' : '❌';
            console.log(`   ${statusIcon} ${chain}: ${status.healthy ? 'Healthy' : 'Unhealthy'}`);
            if (status.latencyMs) {
              console.log(`      Latency: ${status.latencyMs}ms`);
            }
          });
        } else {
          const statusIcon = response.data.healthy ? '✅' : '❌';
          console.log(`   ${statusIcon} ${response.data.chainId || 'Chain'}: ${response.data.healthy ? 'Healthy' : 'Unhealthy'}`);
        }
      }
    } else {
      command.help();
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}
