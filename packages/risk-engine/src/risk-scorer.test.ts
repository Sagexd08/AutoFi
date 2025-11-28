import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEngine } from '../src/risk-scorer';
import type { RiskEvaluationInput, RiskRule } from '../src/types';

describe('RiskEngine', () => {
  let riskEngine: RiskEngine;

  beforeEach(() => {
    riskEngine = new RiskEngine({
      approvalThreshold: 0.6,
      blockThreshold: 0.85,
      maxRiskScore: 0.95,
      runRulesInParallel: false,
      defaultRules: [],
    });
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const engine = new RiskEngine();
      expect(engine).toBeDefined();
      expect(engine.listRules()).toHaveLength(0);
    });

    it('should initialize with custom configuration', () => {
      const engine = new RiskEngine({
        approvalThreshold: 0.5,
        blockThreshold: 0.8,
      });
      expect(engine).toBeDefined();
    });

    it('should initialize with default rules', () => {
      const mockRule: RiskRule = {
        id: 'test-rule',
        label: 'Test Rule',
        description: 'A test rule',
        weight: 0.5,
        evaluate: async () => ({
          id: 'test-rule',
          label: 'Test Rule',
          weight: 0.5,
          normalizedScore: 0.3,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      const engine = new RiskEngine({
        defaultRules: [mockRule],
      });

      expect(engine.listRules()).toHaveLength(1);
      expect(engine.listRules()[0].id).toBe('test-rule');
    });
  });

  describe('Rule Management', () => {
    it('should register a new rule', () => {
      const mockRule: RiskRule = {
        id: 'new-rule',
        label: 'New Rule',
        description: 'A new test rule',
        weight: 1,
        evaluate: async () => ({
          id: 'new-rule',
          label: 'New Rule',
          weight: 1,
          normalizedScore: 0.2,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(mockRule);
      expect(riskEngine.listRules()).toHaveLength(1);
      expect(riskEngine.listRules()[0].id).toBe('new-rule');
    });

    it('should unregister a rule', () => {
      const mockRule: RiskRule = {
        id: 'test-rule',
        label: 'Test Rule',
        description: 'A test rule',
        weight: 1,
        evaluate: async () => ({
          id: 'test-rule',
          label: 'Test Rule',
          weight: 1,
          normalizedScore: 0.1,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(mockRule);
      expect(riskEngine.listRules()).toHaveLength(1);

      riskEngine.unregisterRule('test-rule');
      expect(riskEngine.listRules()).toHaveLength(0);
    });

    it('should list all registered rules', () => {
      const rule1: RiskRule = {
        id: 'rule-1',
        label: 'Rule 1',
        description: 'First test rule',
        weight: 0.5,
        evaluate: async () => ({
          id: 'rule-1',
          label: 'Rule 1',
          weight: 0.5,
          normalizedScore: 0.1,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      const rule2: RiskRule = {
        id: 'rule-2',
        label: 'Rule 2',
        description: 'Second test rule',
        weight: 0.5,
        evaluate: async () => ({
          id: 'rule-2',
          label: 'Rule 2',
          weight: 0.5,
          normalizedScore: 0.2,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(rule1);
      riskEngine.registerRule(rule2);

      const rules = riskEngine.listRules();
      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.id)).toEqual(['rule-1', 'rule-2']);
    });
  });

  describe('Risk Scoring', () => {
    it('should score a low-risk transaction', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);

      expect(assessment.normalizedRisk).toBeLessThan(0.5);
      expect(assessment.classification).toBe('low');
      expect(assessment.blockExecution).toBe(false);
    });

    it('should score a high-risk transaction with large value', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000000000',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment).toBeDefined();
      expect(assessment.normalizedRisk).toBeGreaterThanOrEqual(0);
      expect(assessment.normalizedRisk).toBeLessThanOrEqual(1);
    });

    it('should calculate weighted score correctly', async () => {
      const highRiskRule: RiskRule = {
        id: 'high-risk',
        label: 'High Risk Rule',
        description: 'A high risk rule',
        weight: 1,
        evaluate: async () => ({
          id: 'high-risk',
          label: 'High Risk Rule',
          weight: 1,
          normalizedScore: 0.9,
          level: 'critical',
          triggered: true,
          requiresApproval: true,
          blockExecution: true,
          reasons: ['High risk detected'],
          recommendations: ['Review carefully'],
        }),
      };

      const lowRiskRule: RiskRule = {
        id: 'low-risk',
        label: 'Low Risk Rule',
        description: 'A low risk rule',
        weight: 1,
        evaluate: async () => ({
          id: 'low-risk',
          label: 'Low Risk Rule',
          weight: 1,
          normalizedScore: 0.1,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(highRiskRule);
      riskEngine.registerRule(lowRiskRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBeCloseTo(0.5, 1);
    });

    it('should clamp risk score to [0, 1]', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);

      expect(assessment.normalizedRisk).toBeGreaterThanOrEqual(0);
      expect(assessment.normalizedRisk).toBeLessThanOrEqual(1);
    });
  });

  describe('Risk Classification', () => {
    it('should classify critical risk (>= 0.85)', async () => {
      const criticalRule: RiskRule = {
        id: 'critical',
        label: 'Critical Rule',
        description: 'A critical risk rule',
        weight: 1,
        evaluate: async () => ({
          id: 'critical',
          label: 'Critical Rule',
          weight: 1,
          normalizedScore: 0.95,
          level: 'critical',
          triggered: true,
          requiresApproval: true,
          blockExecution: true,
          reasons: ['Critical risk'],
          recommendations: ['Block execution'],
        }),
      };

      riskEngine.registerRule(criticalRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Approval & Blocking Logic', () => {
    it('should require approval above approval threshold', async () => {
      const approvalThresholdRule: RiskRule = {
        id: 'threshold',
        label: 'Threshold Rule',
        description: 'A threshold rule',
        weight: 1,
        evaluate: async () => ({
          id: 'threshold',
          label: 'Threshold Rule',
          weight: 1,
          normalizedScore: 0.65,
          level: 'high',
          triggered: true,
          requiresApproval: true,
          blockExecution: false,
          reasons: ['Above approval threshold'],
          recommendations: ['Requires manual approval'],
        }),
      };

      riskEngine.registerRule(approvalThresholdRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.requiresApproval).toBe(true);
    });

    it('should block execution above block threshold', async () => {
      const blockThresholdRule: RiskRule = {
        id: 'block-threshold',
        label: 'Block Threshold Rule',
        description: 'A block threshold rule',
        weight: 1,
        evaluate: async () => ({
          id: 'block-threshold',
          label: 'Block Threshold Rule',
          weight: 1,
          normalizedScore: 0.9,
          level: 'critical',
          triggered: true,
          requiresApproval: true,
          blockExecution: true,
          reasons: ['Above block threshold'],
          recommendations: ['Block execution immediately'],
        }),
      };

      riskEngine.registerRule(blockThresholdRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.blockExecution).toBe(true);
    });
  });

  describe('Override System', () => {
    it('should apply forceAllow override', async () => {
      const riskRule: RiskRule = {
        id: 'risky',
        label: 'Risky Rule',
        description: 'A risky rule',
        weight: 1,
        evaluate: async () => ({
          id: 'risky',
          label: 'Risky Rule',
          weight: 1,
          normalizedScore: 0.95,
          level: 'critical',
          triggered: true,
          requiresApproval: true,
          blockExecution: true,
          reasons: ['Critical risk'],
          recommendations: ['Block'],
        }),
      };

      riskEngine.registerRule(riskRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
        overrides: {
          forceAllow: true,
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBe(0);
      expect(assessment.requiresApproval).toBe(false);
      expect(assessment.blockExecution).toBe(false);
    });

    it('should apply forceBlock override', async () => {
      const safeRule: RiskRule = {
        id: 'safe',
        label: 'Safe Rule',
        description: 'A safe rule',
        weight: 1,
        evaluate: async () => ({
          id: 'safe',
          label: 'Safe Rule',
          weight: 1,
          normalizedScore: 0.1,
          level: 'low',
          triggered: false,
          requiresApproval: false,
          blockExecution: false,
          reasons: [],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(safeRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
        overrides: {
          forceBlock: true,
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBe(1);
      expect(assessment.requiresApproval).toBe(true);
      expect(assessment.blockExecution).toBe(true);
    });

    it('should apply maxNormalizedRisk override', async () => {
      const riskRule: RiskRule = {
        id: 'risky',
        label: 'Risky Rule',
        description: 'A risky rule',
        weight: 1,
        evaluate: async () => ({
          id: 'risky',
          label: 'Risky Rule',
          weight: 1,
          normalizedScore: 0.8,
          level: 'high',
          triggered: true,
          requiresApproval: true,
          blockExecution: false,
          reasons: ['High risk'],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(riskRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
        overrides: {
          maxNormalizedRisk: 0.3,
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBe(0.3);
      expect(assessment.blockExecution).toBe(false);
    });

    it('should apply approvalOverride to remove approval requirement', async () => {
      const approvalRule: RiskRule = {
        id: 'approval-needed',
        label: 'Approval Needed',
        description: 'A rule that needs approval',
        weight: 1,
        evaluate: async () => ({
          id: 'approval-needed',
          label: 'Approval Needed',
          weight: 1,
          normalizedScore: 0.65,
          level: 'high',
          triggered: true,
          requiresApproval: true,
          blockExecution: false,
          reasons: ['Needs approval'],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(approvalRule);

      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
        overrides: {
          approvalOverride: true,
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);
      expect(assessment.normalizedRisk).toBeGreaterThan(0.6);
      expect(assessment.requiresApproval).toBe(false);
    });
  });

  describe('Transaction Validation', () => {
    it('should validate a transaction', async () => {
      const result = await riskEngine.validateTransaction({
        owner: '0x0987654321098765432109876543210987654321',
        to: '0x1234567890123456789012345678901234567890',
        type: 'transfer',
        value: BigInt('1000000000000000000'),
      });

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.riskScore).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should block invalid transactions', async () => {
      const criticalRule: RiskRule = {
        id: 'critical',
        label: 'Critical',
        description: 'A critical rule',
        weight: 1,
        evaluate: async () => ({
          id: 'critical',
          label: 'Critical',
          weight: 1,
          normalizedScore: 0.95,
          level: 'critical',
          triggered: true,
          requiresApproval: true,
          blockExecution: true,
          reasons: ['Critical'],
          recommendations: [],
        }),
      };

      riskEngine.registerRule(criticalRule);

      const result = await riskEngine.validateTransaction({
        owner: '0x0987654321098765432109876543210987654321',
        to: '0x1234567890123456789012345678901234567890',
        type: 'transfer',
        value: BigInt('1000000000000000000'),
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty rules list', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);

      expect(assessment).toBeDefined();
      expect(assessment.normalizedRisk).toBeGreaterThanOrEqual(0);
      expect(assessment.normalizedRisk).toBeLessThanOrEqual(1);
    });

    it('should handle null/undefined values gracefully', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          value: undefined,
          data: undefined,
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);

      expect(assessment).toBeDefined();
      expect(assessment.normalizedRisk).toBeDefined();
    });

    it('should handle very large numbers', async () => {
      const input: RiskEvaluationInput = {
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          from: '0x0987654321098765432109876543210987654321',
          value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          operationType: 'transfer',
        },
      };

      const assessment = await riskEngine.scoreTransaction(input);

      expect(assessment.normalizedRisk).toBeGreaterThanOrEqual(0);
      expect(assessment.normalizedRisk).toBeLessThanOrEqual(1);
    });
  });
});
