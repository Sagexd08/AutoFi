export class AutomatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AutomatorError';
  }
}

export class ValidationError extends AutomatorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class BlockchainError extends AutomatorError {
  constructor(message: string, public transactionHash?: string) {
    super(message, 'BLOCKCHAIN_ERROR', 500);
    this.name = 'BlockchainError';
  }
}

export class WorkflowError extends AutomatorError {
  constructor(message: string, public workflowId?: string) {
    super(message, 'WORKFLOW_ERROR', 500);
    this.name = 'WorkflowError';
  }
}
