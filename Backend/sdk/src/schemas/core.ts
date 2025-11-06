import { z } from 'zod';

import type { TransactionRequest, TransactionResponse, AgentResponse, TestResult } from '../types/core';

export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');

export const TransactionHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

export const HexStringSchema = z.string().regex(/^0x([a-fA-F0-9]{2})+$/, 'Invalid hex string format: must start with 0x followed by an even number of hex characters (byte pairs)');

export const NumberStringSchema = z.string().regex(/^\d+$/, 'Must be a number string');

export const NonNegativeNumberStringSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a non-negative number string');

export const TransactionRequestSchema: z.ZodType<TransactionRequest> = z.object({

  to: AddressSchema,

  value: NumberStringSchema.optional(),

  data: HexStringSchema.optional(),

  gasLimit: NumberStringSchema.optional(),

  gasPrice: NumberStringSchema.optional(),

  maxFeePerGas: NumberStringSchema.optional(),

  maxPriorityFeePerGas: NumberStringSchema.optional(),

  nonce: z.number().int().nonnegative().optional(),

  chainId: z.number().int().positive().optional(),

  type: z.enum(['legacy', 'eip1559']).optional(),

}).strict().superRefine((data, ctx) => {

  const { type, gasPrice, maxFeePerGas, maxPriorityFeePerGas } = data;


  if (type === 'legacy') {

    if (maxFeePerGas !== undefined) {

      ctx.addIssue({

        code: z.ZodIssueCode.custom,

        message: 'maxFeePerGas cannot be used with legacy transaction type. Use gasPrice instead.',

        path: ['maxFeePerGas'],

      });

    }

    if (maxPriorityFeePerGas !== undefined) {

      ctx.addIssue({

        code: z.ZodIssueCode.custom,

        message: 'maxPriorityFeePerGas cannot be used with legacy transaction type. Use gasPrice instead.',

        path: ['maxPriorityFeePerGas'],

      });

    }

  }


  if (type === 'eip1559') {

    if (gasPrice !== undefined) {

      ctx.addIssue({

        code: z.ZodIssueCode.custom,

        message: 'gasPrice cannot be used with EIP-1559 transaction type. Use maxFeePerGas and maxPriorityFeePerGas instead.',

        path: ['gasPrice'],

      });

    }

  }


  if (type === undefined) {

    const hasLegacyGas = gasPrice !== undefined;

    const hasEip1559Gas = maxFeePerGas !== undefined || maxPriorityFeePerGas !== undefined;

    if (hasLegacyGas && hasEip1559Gas) {

      if (gasPrice !== undefined) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          message: 'gasPrice cannot be used together with maxFeePerGas or maxPriorityFeePerGas. These gas pricing methods are mutually exclusive.',

          path: ['gasPrice'],

        });

      }

      if (maxFeePerGas !== undefined) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          message: 'maxFeePerGas cannot be used together with gasPrice. These gas pricing methods are mutually exclusive.',

          path: ['maxFeePerGas'],

        });

      }

      if (maxPriorityFeePerGas !== undefined) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          message: 'maxPriorityFeePerGas cannot be used together with gasPrice. These gas pricing methods are mutually exclusive.',

          path: ['maxPriorityFeePerGas'],

        });

      }

    }

  }

});

export const TransactionResponseSchema: z.ZodType<TransactionResponse> = z.object({

  success: z.boolean(),

  txHash: TransactionHashSchema.optional(),

  receipt: z.unknown().optional(),

  error: z.string().optional(),

  gasUsed: NumberStringSchema.optional(),

  gasPrice: NumberStringSchema.optional(),

  blockNumber: z.string().optional(),

  confirmations: z.number().int().nonnegative().optional(),

  duration: z.number().nonnegative().optional(),

  timestamp: z.string(),

}).strict();

export const AgentResponseSchema: z.ZodType<AgentResponse> = z.object({

  success: z.boolean(),

  response: z.string(),

  reasoning: z.string().optional(),

  confidence: z.number().min(0).max(1),

  functionCalls: z.array(z.object({

    name: z.string(),

    parameters: z.record(z.unknown()),

    result: z.unknown().optional(),

    error: z.string().optional(),

    duration: z.number().nonnegative().optional(),

  })),

  executionTime: z.number().nonnegative(),

  agentId: z.string(),

  timestamp: z.string(),

  error: z.string().optional(),

}).strict();

export const TestResultSchema: z.ZodType<TestResult> = z.object({

  success: z.boolean(),

  testName: z.string(),

  duration: z.number().nonnegative(),

  status: z.enum(['passed', 'failed', 'skipped']),

  error: z.string().optional(),

  assertions: z.array(z.object({

    name: z.string(),

    passed: z.boolean(),

    expected: z.unknown(),

    actual: z.unknown(),

    error: z.string().optional(),

  })),

  request: z.object({

    method: z.string(),

    url: z.string(),

    headers: z.record(z.string()),

    body: z.unknown().optional(),

  }).optional(),

  response: z.object({

    status: z.number().int(),

    headers: z.record(z.string()),

    body: z.unknown(),

    duration: z.number().nonnegative(),

  }).optional(),

  timestamp: z.string(),

}).strict();

