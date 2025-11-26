import { AlchemyClient } from '../alchemy-client';
import { SecureTransactionManager } from '../secure-transaction-manager';
import { CeloClient } from '../celo-client';
import { Address, Hash } from 'viem';
import { TransactionRequest } from '../types';
import { TransactionSecurityResult } from '../alchemy-client';
import { SecureTransactionConfig } from '../secure-transaction-manager';

export interface SecurityConfig {
  alchemyApiKey: string;
  alchemyPolicyId?: string;
  network: 'alfajores' | 'mainnet';
  maxRiskScore?: number;
  requireApproval?: boolean;
  enableSimulation?: boolean;
  enableGasOptimization?: boolean;
}

export interface SecurityAnalysisResult {
  isSecure: boolean;
  riskScore: number;
  warnings: string[];
  recommendations: string[];
  gasEstimate: {
    safe: bigint;
    recommended: bigint;
    max: bigint;
  };
}

export async function analyzeTransactionSecurity(
  config: SecurityConfig,
  to: Address,
  value: bigint,
  data?: string,
  from?: Address
): Promise<SecurityAnalysisResult> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const result = await alchemyClient.analyzeTransactionSecurity(to, value, data, from);

  return {
    isSecure: result.isSecure,
    riskScore: result.riskScore,
    warnings: result.warnings,
    recommendations: result.recommendations,
    gasEstimate: result.gasEstimate
  };
}

export async function executeSecureTransaction(
  celoClient: CeloClient,
  config: SecurityConfig,
  transaction: TransactionRequest
): Promise<{
  success: boolean;
  transactionHash?: Hash;
  securityResult: SecurityAnalysisResult;
  gasUsed?: bigint;
  error?: string;
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const secureManager = new SecureTransactionManager(
    alchemyClient,
    celoClient,
    {
      maxRiskScore: config.maxRiskScore || 50,
      requireApproval: config.requireApproval !== false,
      enableSimulation: config.enableSimulation !== false,
      enableGasOptimization: config.enableGasOptimization !== false
    }
  );

  const result = await secureManager.executeSecureTransaction(transaction);

  return {
    success: result.success,
    transactionHash: result.transactionHash,
    securityResult: {
      isSecure: result.securityResult.isSecure,
      riskScore: result.securityResult.riskScore,
      warnings: result.securityResult.warnings,
      recommendations: result.securityResult.recommendations,
      gasEstimate: result.securityResult.gasEstimate
    },
    gasUsed: result.gasUsed,
    error: result.error
  };
}

export async function validateTransaction(
  config: SecurityConfig,
  transaction: TransactionRequest
): Promise<{
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  riskScore: number;
  gasEstimate: bigint;
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const celoClient = new CeloClient(
    '0x0000000000000000000000000000000000000000',
    config.network
  );

  const secureManager = new SecureTransactionManager(
    alchemyClient,
    celoClient,
    {
      maxRiskScore: config.maxRiskScore || 50,
      requireApproval: config.requireApproval !== false,
      enableSimulation: config.enableSimulation !== false,
      enableGasOptimization: config.enableGasOptimization !== false
    }
  );

  const result = await secureManager.validateTransaction(transaction);

  return {
    isValid: result.isValid,
    warnings: result.warnings,
    recommendations: result.recommendations,
    riskScore: result.riskScore,
    gasEstimate: result.gasEstimate
  };
}

export async function getSecurityRecommendations(
  config: SecurityConfig,
  to: Address,
  value: bigint,
  data?: string
): Promise<{
  recommendations: string[];
  riskFactors: string[];
  suggestedGasLimit: bigint;
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const celoClient = new CeloClient(
    '0x0000000000000000000000000000000000000000',
    config.network
  );

  const secureManager = new SecureTransactionManager(
    alchemyClient,
    celoClient,
    {
      maxRiskScore: config.maxRiskScore || 50,
      requireApproval: config.requireApproval !== false,
      enableSimulation: config.enableSimulation !== false,
      enableGasOptimization: config.enableGasOptimization !== false
    }
  );

  return await secureManager.getSecurityRecommendations(to, value, data);
}

export async function isAddressSafe(
  config: SecurityConfig,
  address: Address
): Promise<{
  isSafe: boolean;
  reputation?: string;
  warnings?: string[];
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  try {

    const balance = await alchemyClient['alchemy'].core.getBalance(address);

    if (balance.gt('100000000000000000')) {
      return { isSafe: true, reputation: 'verified' };
    }

    return { isSafe: false, reputation: 'unknown' };
  } catch (error) {
    return {
      isSafe: false,
      reputation: 'unknown',
      warnings: ['Unable to verify address safety']
    };
  }
}
