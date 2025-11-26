import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { WorkflowTemplate } from '@celo-automator/types';

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'dao-treasury-split',
    name: 'DAO Treasury Split',
    description: 'Automatically split DAO funds: send fixed 10 cUSD to treasury when receiving 100+ cUSD',
    category: 'DAO',
    tags: ['dao', 'treasury', 'automation'],
    workflow: {
      name: 'DAO Treasury Split',
      description: 'When DAO receives 100+ cUSD, send fixed 10 cUSD to treasury',
      trigger: {
        type: 'event',
        event: {
          contractAddress: '0x...',
          eventName: 'Transfer',
          filter: {
            to: '0x...',
          },
        },
      },
      actions: [
        {
          type: 'conditional',
          condition: {
            type: 'custom',
            operator: 'gte',
            value: '100000000000000000000',
          },
          actions: [
            {
              type: 'transfer',
              to: '0x...',
              amount: '10000000000000000000',
              tokenAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
            },
          ],
        },
      ],
      enabled: true,
    },
  },
  {
    id: 'recurring-payment',
    name: 'Recurring Payment',
    description: 'Send fixed amount every 6 hours',
    category: 'Payments',
    tags: ['payment', 'recurring', 'cron'],
    workflow: {
      name: 'Recurring Payment',
      description: 'Send 10 CELO every 6 hours',
      trigger: {
        type: 'cron',
        cron: '0 */6 * * *',
      },
      actions: [
        {
          type: 'transfer',
          to: '0x...',
          amount: '10000000000000000000',
        },
      ],
      enabled: true,
    },
  },
  {
    id: 'balance-alert',
    name: 'Balance Alert',
    description: 'Notify when balance exceeds threshold',
    category: 'Monitoring',
    tags: ['monitoring', 'alert', 'balance'],
    workflow: {
      name: 'Balance Alert',
      description: 'Notify when wallet balance exceeds 1000 CELO',
      trigger: {
        type: 'condition',
        condition: {
          type: 'balance',
          operator: 'gt',
          value: '1000000000000000000000',
        },
      },
      actions: [
        {
          type: 'notify',
          webhookUrl: 'https://hooks.slack.com/...',
          message: 'Wallet balance exceeded 1000 CELO',
        },
      ],
      enabled: true,
    },
  },
];

export function saveWorkflowTemplate(template: WorkflowTemplate, outputDir: string = './examples') {
  const filename = join(outputDir, `${template.id}.json`);

  try {
    mkdirSync(dirname(filename), { recursive: true });

    writeFileSync(filename, JSON.stringify(template.workflow, null, 2));
    console.log(`Saved template to ${filename}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to save workflow template to ${filename}: ${errorMessage}`);
    throw error;
  }
}
