import { ValidatorFinding, RiskLevel, RiskEvaluationInput } from './types.js';
import { z } from 'zod';
import type { TransactionContext } from './types.js';

function toBigInt(value?: string): bigint | undefined {
  if (!value) return undefined;
  try {
    if (value.startsWith('0x') || value.startsWith('0X')) {
      return BigInt(value);
    }
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function buildFinding(
  id: string,
  level: RiskLevel,
  message: string,
  metadata?: Record<string, unknown>
): ValidatorFinding {
  return {
    id,
    level,
    message,
    metadata,
  };
}

export interface ValidationResultWithFindings {
  valid: boolean;
  findings: ValidatorFinding[];
}

export function validateTransactionStructure(
  input: RiskEvaluationInput
): ValidationResultWithFindings {
  const findings: ValidatorFinding[] = [];

  if (!input.transaction.to) {
    findings.push(
      buildFinding(
        'missing_to',
        'critical',
        'Transaction recipient address is missing.'
      )
    );
  }

  if (!input.transaction.operationType && !input.transaction.data) {
    findings.push(
      buildFinding(
        'missing_intent',
        'medium',
        'Neither operation type nor calldata provided; unable to determine intent.'
      )
    );
  }

  return {
    valid: findings.length === 0,
    findings,
  };
}

export function validateSpendingLimits(
  input: RiskEvaluationInput
): ValidationResultWithFindings {
  const findings: ValidatorFinding[] = [];

  if (!input.agent) {
    return { valid: true, findings };
  }

  const value = toBigInt(input.transaction.value);
  const perTxLimit = toBigInt(input.agent.perTxLimit);
  const dailyLimit = toBigInt(input.agent.dailyLimit);
  const cumulative = toBigInt(input.agent.cumulative24h);

  if (value && perTxLimit && value > perTxLimit) {
    findings.push(
      buildFinding(
        'per_tx_limit_exceeded',
        'high',
        `Transaction value ${value.toString()} exceeds per-transaction limit ${perTxLimit.toString()}.`,
        { value: value.toString(), perTxLimit: perTxLimit.toString() }
      )
    );
  }

  if (value && dailyLimit) {
    const projected = value + (cumulative ?? 0n);
    if (projected > dailyLimit) {
      findings.push(
        buildFinding(
          'daily_limit_exceeded',
          'high',
          `Daily spending exceeded: projected ${projected.toString()} vs limit ${dailyLimit.toString()}.`,
          {
            projected: projected.toString(),
            dailyLimit: dailyLimit.toString(),
          }
        )
      );
    }
  }

  return {
    valid: findings.length === 0,
    findings,
  };
}

export function combineValidationResults(
  ...results: ValidationResultWithFindings[]
): ValidationResultWithFindings {
  const findings = results.flatMap((result) => result.findings);
  return {
    valid: findings.every((finding) => finding.level === 'low' || finding.level === 'medium'),
    findings,
  };
}

const transactionSchema = z.object({
  agentId: z.string().min(1),
  owner: z.string().optional(),
  type: z.enum(['transfer', 'contract_call', 'deployment']),
  to: z.string().optional(),
  value: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((val) => (typeof val === 'string' ? BigInt(val) : typeof val === 'number' ? BigInt(Math.trunc(val)) : val))
    .optional(),
  tokenAddress: z.string().optional(),
  functionSignature: z.string().optional(),
  protocol: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(),
  simulatedChanges: z.record(z.unknown()).optional(),
});

export function validateTransactionContext(input: TransactionContext): TransactionContext {
  const parsed = transactionSchema.parse(input);
  return {
    ...input,
    value: parsed.value,
  };
}
