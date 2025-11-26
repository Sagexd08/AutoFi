import { z } from 'zod';

export const ValidationSchemas = {
  agentCreateRequest: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    model: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    config: z.record(z.unknown()).optional(),
  }),

  agentQueryRequest: z.object({
    prompt: z.string().min(1),
    context: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    streaming: z.boolean().optional(),
    intentOnly: z.boolean().optional(),
  }),

  transactionRequest: z.object({
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    value: z.string().optional(),
    data: z.string().optional(),
    gasLimit: z.string().optional(),
    gasPrice: z.string().optional(),
    maxFeePerGas: z.string().optional(),
    maxPriorityFeePerGas: z.string().optional(),
    chainId: z.union([z.number(), z.string()]).optional(),
    nonce: z.number().optional(),
    agentId: z.string().optional(),
    memo: z.string().optional(),
    simulateOnly: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  contractDeploymentRequest: z.object({
    contractName: z.string().min(1),
    abi: z.unknown().optional(),
    bytecode: z.string().optional(),
    args: z.array(z.unknown()).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    agentId: z.string().optional(),
    network: z.string().optional(),
    gasLimit: z.string().optional(),
    gasPrice: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  spendingLimitConfig: z.object({
    agentId: z.string().min(1),
    dailyLimit: z.string().min(1),
    perTxLimit: z.string().min(1),
    currency: z.string().optional(),
    effectiveFrom: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.errors.map((e) => e.message).join(', ')}`);
  }
  return result.data;
}

