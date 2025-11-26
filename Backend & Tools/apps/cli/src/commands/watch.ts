import chalk from 'chalk';

export async function watchCommand(options: any) {
  console.log(chalk.yellow('👀 Blockchain event watching feature coming soon'));
  if (options.contract) {
    console.log(chalk.gray(`Contract: ${options.contract}`));
  }
  if (options.event) {
    console.log(chalk.gray(`Event: ${options.event}`));
  }
}
