import chalk from 'chalk';
import { getConfig } from './init.js';
import { writeFileSync, existsSync, readFileSync, renameSync } from 'fs';
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

    let existingConfig: Record<string, any> = {};
    if (existsSync(CONFIG_FILE)) {
      try {
        const configContent = readFileSync(CONFIG_FILE, 'utf-8');
        existingConfig = JSON.parse(configContent);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(chalk.red(`❌ Configuration file is corrupted: ${errorMessage}`));
        console.error(chalk.yellow(`   Falling back to empty configuration.`));

        try {
          const backupPath = `${CONFIG_FILE}.corrupted.${Date.now()}`;
          renameSync(CONFIG_FILE, backupPath);
          console.error(chalk.yellow(`   Corrupted config backed up to: ${backupPath}`));
        } catch (backupError) {
          console.error(chalk.yellow(`   Warning: Could not backup corrupted config file`));
        }
      }
    }

    existingConfig[key] = value;

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
