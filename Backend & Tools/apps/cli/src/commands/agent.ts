import axios from 'axios';
import type { Command } from 'commander';

const API_URL = process.env.CELO_AI_API_URL || 'http://localhost:3000';

export async function agentCommand(options: any, command: Command) {
  const jsonOutput = options.json || false;

  try {
    if (options.create) {
      const response = await axios.post(`${API_URL}/api/agents`, {
        type: options.type || 'treasury',
        name: options.name || 'New Agent',
        description: options.description,
        objectives: options.objectives ? options.objectives.split(',') : undefined,
      });

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log(`✅ Agent created: ${response.data.agent.id}`);
        console.log(`   Type: ${response.data.agent.type}`);
        console.log(`   Name: ${response.data.agent.name}`);
      }
    } else if (options.list) {
      const response = await axios.get(`${API_URL}/api/agents`);

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('📋 Agents:');
        response.data.agents.forEach((agent: any) => {
          console.log(`   ${agent.id} - ${agent.name} (${agent.type})`);
        });
      }
    } else if (options.query) {
      const agentId = options.query;
      const prompt = options.prompt || command.args[0] || '';

      if (!prompt) {
        console.error('❌ Prompt is required for query');
        process.exit(1);
      }

      const response = await axios.post(`${API_URL}/api/agents/${agentId}/query`, {
        prompt,
        context: options.context ? JSON.parse(options.context) : undefined,
      });

      if (jsonOutput) {
        console.log(JSON.stringify(response.data, null, 2));
      } else {
        console.log('🤖 Agent Response:');
        console.log(`   Reasoning: ${response.data.result.reasoning}`);
        console.log(`   Risk Score: ${response.data.result.riskSummary.aggregateScore}`);
      }
    } else {
      command.help();
    }
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

