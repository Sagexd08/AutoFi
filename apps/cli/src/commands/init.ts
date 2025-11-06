import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync, chmodSync } from 'fs';
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

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    chmodSync(CONFIG_FILE, 0o600); // Owner read/write only
    console.log(chalk.green(`\n✅ Configuration saved to ${CONFIG_FILE}`));
    console.log(chalk.yellow('⚠️  Configuration contains sensitive data. Keep it secure.'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\n❌ Failed to save configuration: ${errorMessage}`));
    process.exit(1);
  }}

export function getConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\n❌ Failed to read or parse configuration file ${CONFIG_FILE}: ${errorMessage}`));
    return null;
  }
}
