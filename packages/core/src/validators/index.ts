import { z } from 'zod';
import { isValidAddress } from '../utils/index.js';
import type { Workflow } from '@celo-automator/types';

export const AddressSchema = z.string().refine(isValidAddress, {
  message: 'Invalid address format',
});

export const AmountSchema = z.string().regex(/^\d+$/, {
  message: 'Amount must be a numeric string',
});

export function validateWorkflow(workflow: unknown): workflow is Workflow {
  try {
    // Basic validation - can be enhanced with full schema validation
    const w = workflow as Workflow;
    return (
      typeof w === 'object' &&
      w !== null &&
      typeof w.name === 'string' &&
      Array.isArray(w.actions) &&
      w.actions.length > 0 &&
      typeof w.trigger === 'object'
    );
  } catch {
    return false;
  }
}

export function validateAddress(address: string): boolean {
  return isValidAddress(address);
}
