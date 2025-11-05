import { writeFileSync } from 'fs';
import { join } from 'path';
import type { WorkflowTemplate } from '@celo-automator/types';

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'dao-treasury-split',
    name: 'DAO Treasury Split',
    description: 'Automatically split DAO funds: 10% to treasury when receiving 100+ cUSD',
    category: 'DAO',
    tags: ['dao', 'treasury', 'automation'],
    workflow: {
      name: 'DAO Treasury Split',
      description: 'When DAO receives 100+ cUSD, send 10% to treasury',
      trigger: {
        type: 'event',
        event: {
          contractAddress: '0x...', // DAO contract address
          eventName: 'Transfer',
          filter: {
            to: '0x...', // DAO address
          },
        },
      },
      actions: [
        {
          type: 'conditional',
          condition: {
            type: 'custom',
            operator: 'gte',
            value: '100000000000000000000', // 100 cUSD in wei
          },
          actions: [
            {
              type: 'transfer',
              to: '0x...', // Treasury address
              amount: '10000000000000000000', // 10% of 100 cUSD
              tokenAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD on mainnet
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
          to: '0x...', // Recipient address
          amount: '10000000000000000000', // 10 CELO in wei
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
          value: '1000000000000000000000', // 1000 CELO in wei
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
  writeFileSync(filename, JSON.stringify(template.workflow, null, 2));
  console.log(`Saved template to ${filename}`);
}
