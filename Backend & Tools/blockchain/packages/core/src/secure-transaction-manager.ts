import { Address, Hash, Hex } from 'viem';
import { AlchemyClient, TransactionSecurityResult, NFTOperation, NFTMintResult } from './alchemy-client';
import { CeloClient } from './celo-client';
import { TransactionRequest, SimulationResult, ValidationResult } from './types';

export interface SecureTransactionConfig {
  maxRiskScore: number;
  requireApproval: boolean;
  enableSimulation: boolean;
  enableGasOptimization: boolean;
}

export interface TransactionApproval {
  approved: boolean;
  reason?: string;
  conditions?: string[];
}

export class SecureTransactionManager {
  private alchemyClient: AlchemyClient;
  private celoClient: CeloClient;
  private config: SecureTransactionConfig;

  constructor(
    alchemyClient: AlchemyClient,
    celoClient: CeloClient,
    config: SecureTransactionConfig = {
      maxRiskScore: 50,
      requireApproval: true,
      enableSimulation: true,
      enableGasOptimization: true
    }
  ) {
    this.alchemyClient = alchemyClient;
    this.celoClient = celoClient;
    this.config = config;
  }

  async executeSecureTransaction(
    request: TransactionRequest,
    approval?: TransactionApproval
  ): Promise<{
    success: boolean;
    transactionHash?: Hash;
    securityResult: TransactionSecurityResult;
    gasUsed?: bigint;
    error?: string;
  }> {
    try {

      const securityResult = await this.alchemyClient.analyzeTransactionSecurity(
        request.to,
        request.value || BigInt(0),
        request.data,
        request.from
      );

      if (securityResult.riskScore > this.config.maxRiskScore) {
        return {
          success: false,
          securityResult,
          error: `Transaction risk score (${securityResult.riskScore}) exceeds maximum allowed (${this.config.maxRiskScore})`
        };
      }

      if (this.config.requireApproval && !approval?.approved) {
        return {
          success: false,
          securityResult,
          error: 'Transaction requires approval but none provided'
        };
      }

      if (this.config.enableSimulation) {
        const simulation = await this.alchemyClient.simulateTransaction(
          request.from || '0x0000000000000000000000000000000000000000',
          request.to,
          request.value || BigInt(0),
          request.data
        );

        if (!simulation.success) {
          return {
            success: false,
            securityResult,
            error: 'Transaction simulation failed'
          };
        }
      }

      const gasLimit = this.config.enableGasOptimization
        ? securityResult.gasEstimate.recommended
        : securityResult.gasEstimate.max;

      const transactionHash = await this.celoClient.sendTransaction({
        ...request,
        gasLimit: gasLimit
      });

      return {
        success: true,
        transactionHash,
        securityResult,
        gasUsed: securityResult.gasEstimate.recommended
      };
    } catch (error) {
      return {
        success: false,
        securityResult: {
          isSecure: false,
          riskScore: 100,
          warnings: ['Transaction execution failed'],
          recommendations: ['Check transaction parameters'],
          gasEstimate: {
            safe: BigInt(21000),
            recommended: BigInt(50000),
            max: BigInt(100000)
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async mintSecureNFT(
    operation: NFTOperation,
    approval?: TransactionApproval
  ): Promise<{
    success: boolean;
    result?: NFTMintResult;
    securityResult: TransactionSecurityResult;
    error?: string;
  }> {
    try {

      const securityResult = await this.alchemyClient.analyzeTransactionSecurity(
        operation.contractAddress,
        BigInt(0),
        undefined,
        operation.from
      );

      if (this.config.requireApproval && !approval?.approved) {
        return {
          success: false,
          securityResult,
          error: 'NFT minting requires approval but none provided'
        };
      }

      const result = await this.alchemyClient.mintNFT(operation);

      return {
        success: result.success,
        result,
        securityResult,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        securityResult: {
          isSecure: false,
          riskScore: 100,
          warnings: ['NFT minting failed'],
          recommendations: ['Check contract permissions'],
          gasEstimate: {
            safe: BigInt(100000),
            recommended: BigInt(150000),
            max: BigInt(200000)
          }
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async executeBatchTransactions(
    requests: TransactionRequest[],
    approvals?: TransactionApproval[]
  ): Promise<{
    results: Array<{
      success: boolean;
      transactionHash?: Hash;
      error?: string;
    }>;
    overallSuccess: boolean;
  }> {
    const results = [];
    let overallSuccess = true;

    for (let i = 0; i < requests.length; i++) {
      const result = await this.executeSecureTransaction(
        requests[i],
        approvals?.[i]
      );

      results.push({
        success: result.success,
        transactionHash: result.transactionHash,
        error: result.error
      });

      if (!result.success) {
        overallSuccess = false;
      }
    }

    return { results, overallSuccess };
  }

  async getSecurityRecommendations(
    to: Address,
    value: bigint,
    data?: string
  ): Promise<{
    recommendations: string[];
    riskFactors: string[];
    suggestedGasLimit: bigint;
  }> {
    const securityResult = await this.alchemyClient.analyzeTransactionSecurity(to, value, data);

    return {
      recommendations: securityResult.recommendations,
      riskFactors: securityResult.warnings,
      suggestedGasLimit: securityResult.gasEstimate.recommended
    };
  }

  async validateTransaction(request: TransactionRequest): Promise<ValidationResult> {
    try {
      const securityResult = await this.alchemyClient.analyzeTransactionSecurity(
        request.to,
        request.value || BigInt(0),
        request.data,
        request.from
      );

      const isValid = securityResult.isSecure && securityResult.riskScore <= this.config.maxRiskScore;

      return {
        isValid,
        errors: [],
        warnings: securityResult.warnings,
        recommendations: securityResult.recommendations,
        riskScore: securityResult.riskScore,
        gasEstimate: securityResult.gasEstimate.recommended
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Validation failed'],
        warnings: ['Validation failed'],
        recommendations: ['Manual review required'],
        riskScore: 100,
        gasEstimate: BigInt(50000)
      };
    }
  }

  updateSecurityConfig(newConfig: Partial<SecureTransactionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getSecurityConfig(): SecureTransactionConfig {
    return { ...this.config };
  }
}
