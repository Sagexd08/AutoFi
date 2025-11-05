import axios from 'axios';
import chalk from 'chalk';
import { getConfig } from './init.js';

const API_BASE = process.env.CELO_AUTO_API_URL || 'http://localhost:3000';

export async function explainCommand(input: string) {
  const config = getConfig();
  const apiUrl = config?.apiUrl || API_BASE;

  try {
    const response = await axios.post(`${apiUrl}/api/workflows/interpret`, {
      input,
    });

    if (response.data.success) {
      console.log(chalk.blue.bold('\n🤖 AI Interpretation:\n'));
      console.log(response.data.explanation);

      if (response.data.workflow) {
        console.log(chalk.cyan('\n📋 Generated Workflow:\n'));
        console.log(JSON.stringify(response.data.workflow, null, 2));
      }
    } else {
      console.error(chalk.red('Failed to interpret:'), response.data.error);
    }
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}
