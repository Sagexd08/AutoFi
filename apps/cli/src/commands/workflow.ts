import axios from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig } from './init.js';

const API_BASE = process.env.CELO_AUTO_API_URL || 'http://localhost:3000';

export async function workflowCommand(options: any) {
  const config = getConfig();
  const apiUrl = config?.apiUrl || API_BASE;

  if (options.create) {
    await createWorkflow(apiUrl);
  } else if (options.list) {
    await listWorkflows(apiUrl);
  } else if (options.execute) {
    await executeWorkflow(apiUrl, options.execute);
  } else if (options.describe) {
    await describeWorkflow(apiUrl, options.describe);
  } else {
    // Interactive mode
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create workflow', value: 'create' },
          { name: 'List workflows', value: 'list' },
          { name: 'Execute workflow', value: 'execute' },
          { name: 'Describe workflow', value: 'describe' },
        ],
      },
    ]);

    switch (action) {
      case 'create':
        await createWorkflow(apiUrl);
        break;
      case 'list':
        await listWorkflows(apiUrl);
        break;
      case 'execute':
        const { id } = await inquirer.prompt([
          { type: 'input', name: 'id', message: 'Workflow ID:' },
        ]);
        await executeWorkflow(apiUrl, id);
        break;
      case 'describe':
        const { descId } = await inquirer.prompt([
          { type: 'input', name: 'descId', message: 'Workflow ID:' },
        ]);
        await describeWorkflow(apiUrl, descId);
        break;
    }
  }
}

async function createWorkflow(apiUrl: string) {
  const { input } = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message: 'Describe your automation workflow in natural language:',
    },
  ]);

  try {
    const response = await axios.post(`${apiUrl}/api/workflows/interpret`, {
      input,
    });

    if (response.data.success) {
      console.log(chalk.green('\n✅ Workflow created successfully!\n'));
      console.log(chalk.cyan('Workflow:'));
      console.log(JSON.stringify(response.data.workflow, null, 2));
      console.log(chalk.cyan('\nExplanation:'));
      console.log(response.data.explanation);

      const { save } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'save',
          message: 'Save this workflow?',
          default: true,
        },
      ]);

      if (save) {
        await axios.post(`${apiUrl}/api/workflows`, response.data.workflow);
        console.log(chalk.green('Workflow saved!'));
      }
    }
  } catch (error: any) {
    console.error(chalk.red('Error creating workflow:'), error.message);
  }
}

async function listWorkflows(apiUrl: string) {
  try {
    const response = await axios.get(`${apiUrl}/api/workflows`);
    const workflows = response.data.workflows || [];

    if (workflows.length === 0) {
      console.log(chalk.yellow('No workflows found'));
      return;
    }

    console.log(chalk.blue.bold('\n📋 Workflows:\n'));
    workflows.forEach((wf: any) => {
      console.log(chalk.cyan(`  ${wf.id || 'N/A'}`));
      console.log(chalk.white(`    Name: ${wf.name}`));
      console.log(chalk.gray(`    Description: ${wf.description || 'N/A'}`));
      console.log('');
    });
  } catch (error: any) {
    console.error(chalk.red('Error listing workflows:'), error.message);
  }
}

async function executeWorkflow(apiUrl: string, workflowId: string) {
  try {
    const response = await axios.post(`${apiUrl}/api/workflows/${workflowId}/execute`);
    const execution = response.data.execution;

    console.log(chalk.green(`\n✅ Execution started!`));
    console.log(chalk.cyan(`Execution ID: ${execution.id}`));
    console.log(chalk.gray(`Status: ${execution.status}`));

    // Poll for completion
    let status = execution.status;
    while (status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(
        `${apiUrl}/api/workflows/executions/${execution.id}`
      );
      status = statusResponse.data.execution.status;

      if (status === 'completed') {
        console.log(chalk.green('\n✅ Execution completed!'));
        console.log(JSON.stringify(statusResponse.data.execution.results, null, 2));
      } else if (status === 'failed') {
        console.log(chalk.red('\n❌ Execution failed!'));
        console.log(chalk.red(statusResponse.data.execution.error));
      }
    }
  } catch (error: any) {
    console.error(chalk.red('Error executing workflow:'), error.message);
  }
}

async function describeWorkflow(apiUrl: string, workflowId: string) {
  try {
    const response = await axios.post(`${apiUrl}/api/workflows/${workflowId}/explain`);
    console.log(chalk.blue.bold('\n📖 Workflow Explanation:\n'));
    console.log(response.data.explanation);
  } catch (error: any) {
    console.error(chalk.red('Error describing workflow:'), error.message);
  }
}
