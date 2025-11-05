import chalk from 'chalk';
import { getConfig } from './init.js';

export async function configCommand(options: any) {
  const config = getConfig();

  if (options.list) {
    console.log(chalk.blue.bold('\n⚙️  Configuration:\n'));
    console.log(JSON.stringify(config || {}, null, 2));
  } else if (options.get) {
    console.log(chalk.cyan(`${options.get}: ${config?.[options.get] || 'Not set'}`));
  } else if (options.set) {
    console.log(chalk.yellow('Configuration setting feature coming soon'));
  } else {
    console.log(chalk.yellow('Use --list, --get <key>, or --set <key> <value>'));
  }
}
