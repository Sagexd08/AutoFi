import { z } from 'zod';

export const WorkflowTriggerSchema = z.object({
  type: z.enum(['event', 'cron', 'manual', 'condition']),
  event?: z.object({
    contractAddress: z.string(),
    eventName: z.string(),
    filter: z.record(z.any()).optional(),
  }),
  cron?: z.string(),
  condition?: z.object({
    type: z.enum(['balance', 'price', 'custom']),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    value: z.union([z.string(), z.number()]),
  }),
});

export const WorkflowActionSchema = z.object({
  type: z.enum([
    'transfer',
    'contract_call',
    'deploy',
    'notify',
    'conditional',
    'batch',
  ]),
  to?: z.string(),
  amount?: z.string(),
  tokenAddress?: z.string(),
  contractAddress?: z.string(),
  functionName?: z.string(),
  parameters?: z.array(z.any()),
  webhookUrl?: z.string(),
  message?: z.string(),
  condition?: z.object({
    type: z.string(),
    operator: z.string(),
    value: z.union([z.string(), z.number()]),
  }),
  actions?: z.array(z.lazy(() => WorkflowActionSchema)),
});

export const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  trigger: WorkflowTriggerSchema,
  actions: z.array(WorkflowActionSchema),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  error?: string;
  results?: Record<string, any>;
  transactionHashes?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Omit<Workflow, 'id'>;
  tags: string[];
}
