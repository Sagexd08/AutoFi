import chalk from 'chalk';
import { getConfig } from './init.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.celoauto.json');

export async function configCommand(options: any) {
  const config = getConfig();

  if (options.list) {
    console.log(chalk.blue.bold('\n⚙️  Configuration:\n'));
    console.log(JSON.stringify(config || {}, null, 2));
  } else if (options.get) {
    console.log(chalk.cyan(`${options.get}: ${config?.[options.get] || 'Not set'}`));
  } else if (options.set) {
    // Handle options.set as an array
    if (!Array.isArray(options.set)) {
      console.error(chalk.red('Error: --set requires both key and value'));
      process.exit(1);
    }

    if (options.set.length < 2) {
      console.error(chalk.red('Error: --set requires both key and value'));
      console.log(chalk.yellow('Usage: --set <key> <value>'));
      process.exit(1);
    }

    const key = options.set[0];
    const value = options.set[1];

    if (!key || !value) {
      console.error(chalk.red('Error: key and value cannot be empty'));
      process.exit(1);
    }

    // Read existing config or create new one
    const existingConfig = existsSync(CONFIG_FILE)
      ? JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      : {};

    // Update the config
    existingConfig[key] = value;

    // Write back to file
    try {
      writeFileSync(CONFIG_FILE, JSON.stringify(existingConfig, null, 2));
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow('Use --list, --get <key>, or --set <key> <value>'));
  }
}
