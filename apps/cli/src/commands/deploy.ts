import chalk from 'chalk';
import { getConfig } from './init.js';

export async function deployCommand(options: any) {
  console.log(chalk.yellow('📦 Contract deployment feature coming soon'));
  console.log(chalk.gray(`Network: ${options.network}`));
  if (options.contract) {
    console.log(chalk.gray(`Contract: ${options.contract}`));
  }
}
