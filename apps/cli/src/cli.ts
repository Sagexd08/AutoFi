#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import { initCommand } from './commands/init.js';
import { deployCommand } from './commands/deploy.js';
import { workflowCommand } from './commands/workflow.js';
import { watchCommand } from './commands/watch.js';
import { explainCommand } from './commands/explain.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('celo-auto')
  .description('Celo Automator CLI - AI-powered blockchain automation')
  .version('2.0.0');

program
  .command('init')
  .description('Initialize Celo Automator configuration')
  .action(async () => {
    const spinner = ora('Initializing Celo Automator').start();
    try {
      await initCommand();
      spinner.succeed('Celo Automator initialized successfully');
    } catch (error) {
      spinner.fail(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Deploy smart contracts')
  .option('-n, --network <network>', 'Network to deploy to', 'alfajores')
  .option('-c, --contract <contract>', 'Contract name to deploy')
  .action(async (options) => {
    const spinner = ora('Deploying contracts').start();
    try {
      await deployCommand(options);
      spinner.succeed('Contracts deployed successfully');
    } catch (error) {
      spinner.fail(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('workflow')
  .description('Manage workflows')
  .option('-c, --create', 'Create a new workflow')
  .option('-l, --list', 'List all workflows')
  .option('-e, --execute <id>', 'Execute a workflow by ID')
  .option('-d, --describe <id>', 'Describe a workflow')
  .action(async (options) => {
    const spinner = ora('Processing workflow').start();
    try {
      await workflowCommand(options);
      spinner.succeed('Workflow operation completed');
    } catch (error) {
      spinner.fail(`Workflow operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch blockchain events')
  .option('-c, --contract <address>', 'Contract address to watch')
  .option('-e, --event <name>', 'Event name to watch')
  .action(async (options) => {
    await watchCommand(options);
  });

program
  .command('explain')
  .description('AI-powered explanation of natural language requests')
  .argument('<input>', 'Natural language description')
  .action(async (input) => {
    const spinner = ora('Interpreting request').start();
    try {
      await explainCommand(input);
      spinner.succeed('Request interpreted successfully');
    } catch (error) {
      spinner.fail(`Failed to explain: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('-s, --set <items...>', 'Set a configuration value (key and value)')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-l, --list', 'List all configuration')
  .action(async (options) => {
    await configCommand(options);
  });

program.parse();
