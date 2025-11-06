export const ERROR_CODES = {


  INVALID_ADDRESS: 'INVALID_ADDRESS',

  INVALID_TRANSACTION: 'INVALID_TRANSACTION',

  INVALID_AGENT_CONFIG: 'INVALID_AGENT_CONFIG',

  INVALID_CONTRACT_CONFIG: 'INVALID_CONTRACT_CONFIG',

  INVALID_PRIVATE_KEY: 'INVALID_PRIVATE_KEY',

  INVALID_CHAIN_ID: 'INVALID_CHAIN_ID',

  INVALID_AMOUNT: 'INVALID_AMOUNT',

  INVALID_GAS_PRICE: 'INVALID_GAS_PRICE',

  INVALID_URL: 'INVALID_URL',

  INVALID_API_KEY: 'INVALID_API_KEY',

  VALIDATION_ERROR: 'VALIDATION_ERROR',


  CHAIN_NOT_SUPPORTED: 'CHAIN_NOT_SUPPORTED',

  CHAIN_CONNECTION_FAILED: 'CHAIN_CONNECTION_FAILED',

  CHAIN_RPC_ERROR: 'CHAIN_RPC_ERROR',


  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',

  AGENT_CREATION_FAILED: 'AGENT_CREATION_FAILED',

  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',


  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',

  CONTRACT_DEPLOYMENT_FAILED: 'CONTRACT_DEPLOYMENT_FAILED',

  CONTRACT_CALL_FAILED: 'CONTRACT_CALL_FAILED',


  TRANSACTION_FAILED: 'TRANSACTION_FAILED',

  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',

  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT',

  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',

  GAS_ESTIMATION_FAILED: 'GAS_ESTIMATION_FAILED',


  NETWORK_ERROR: 'NETWORK_ERROR',

  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',


  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',

  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',

  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',


  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  INTERNAL_ERROR: 'INTERNAL_ERROR',

  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

} as const;

export const ERROR_MESSAGES: Record<string, string> = {

  [ERROR_CODES.INVALID_ADDRESS]: 'Invalid address format. Address must be a 42-character hexadecimal string starting with 0x.',

  [ERROR_CODES.INVALID_TRANSACTION]: 'Invalid transaction request. Missing required fields or invalid format.',

  [ERROR_CODES.INVALID_AGENT_CONFIG]: 'Invalid agent configuration. Missing required fields or invalid format.',

  [ERROR_CODES.INVALID_CONTRACT_CONFIG]: 'Invalid contract configuration. Missing required fields or invalid format.',

  [ERROR_CODES.INVALID_PRIVATE_KEY]: 'Invalid private key format. Private key must be a 66-character hexadecimal string starting with 0x.',

  [ERROR_CODES.INVALID_CHAIN_ID]: 'Invalid chain ID. Chain ID must be a positive number.',

  [ERROR_CODES.INVALID_AMOUNT]: 'Invalid amount. Amount must be a non-negative number string.',

  [ERROR_CODES.INVALID_GAS_PRICE]: 'Invalid gas price. Gas price must be a positive number string.',

  [ERROR_CODES.INVALID_URL]: 'Invalid URL format.',

  [ERROR_CODES.INVALID_API_KEY]: 'Invalid API key. API key must be at least 10 characters long.',

  [ERROR_CODES.VALIDATION_ERROR]: 'Validation failed. Check the provided data and try again.',

  [ERROR_CODES.CHAIN_NOT_SUPPORTED]: 'The specified chain is not supported.',

  [ERROR_CODES.CHAIN_CONNECTION_FAILED]: 'Failed to connect to the blockchain network.',

  [ERROR_CODES.CHAIN_RPC_ERROR]: 'RPC call to the blockchain network failed.',

  [ERROR_CODES.AGENT_NOT_FOUND]: 'The specified agent was not found.',

  [ERROR_CODES.AGENT_CREATION_FAILED]: 'Failed to create the agent.',

  [ERROR_CODES.AGENT_EXECUTION_FAILED]: 'Agent execution failed.',

  [ERROR_CODES.CONTRACT_NOT_FOUND]: 'The specified contract was not found.',

  [ERROR_CODES.CONTRACT_DEPLOYMENT_FAILED]: 'Contract deployment failed.',

  [ERROR_CODES.CONTRACT_CALL_FAILED]: 'Contract call failed.',

  [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed.',

  [ERROR_CODES.TRANSACTION_REVERTED]: 'Transaction was reverted by the blockchain.',

  [ERROR_CODES.TRANSACTION_TIMEOUT]: 'Transaction timed out.',

  [ERROR_CODES.INSUFFICIENT_FUNDS]: 'Insufficient funds to complete the transaction.',

  [ERROR_CODES.GAS_ESTIMATION_FAILED]: 'Failed to estimate gas for the transaction.',

  [ERROR_CODES.NETWORK_ERROR]: 'Network error occurred.',

  [ERROR_CODES.NETWORK_TIMEOUT]: 'Network request timed out.',

  [ERROR_CODES.NETWORK_UNAVAILABLE]: 'Network is currently unavailable.',

  [ERROR_CODES.AUTHENTICATION_ERROR]: 'Authentication failed.',

  [ERROR_CODES.AUTHORIZATION_ERROR]: 'Authorization failed. Insufficient permissions.',

  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please try again later.',

  [ERROR_CODES.UNKNOWN_ERROR]: 'An unknown error occurred.',

  [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred.',

  [ERROR_CODES.CONFIGURATION_ERROR]: 'Configuration error. Check your SDK configuration.',

};

