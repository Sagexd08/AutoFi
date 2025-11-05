import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.celoauto.json');

export async function initCommand() {
  console.log(chalk.blue.bold('\n🚀 Celo Automator Setup\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL (default: http://localhost:3000):',
      default: 'http://localhost:3000',
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (optional):',
    },
    {
      type: 'list',
      name: 'network',
      message: 'Default network:',
      choices: ['alfajores', 'mainnet'],
      default: 'alfajores',
    },
    {
      type: 'input',
      name: 'privateKey',
      message: 'Private key (optional, for local operations):',
      when: () => true,
    },
    {
      type: 'input',
      name: 'geminiApiKey',
      message: 'Gemini API Key (for AI features):',
    },
  ]);

  const config = {
    apiUrl: answers.apiUrl,
    apiKey: answers.apiKey || undefined,
    defaultNetwork: answers.network,
    privateKey: answers.privateKey || undefined,
    geminiApiKey: answers.geminiApiKey,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(chalk.green(`\n✅ Configuration saved to ${CONFIG_FILE}`));
}

export function getConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}
