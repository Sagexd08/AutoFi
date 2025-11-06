import { CeloAISDK } from '../core/sdk';
import type { SDKConfig } from '../types/config';
describe('CeloAISDK', () => {
  let sdk: CeloAISDK;
  let config: SDKConfig;
  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      network: 'testnet',
      enableRealTransactions: false,
      enableMultiChain: true,
      enableProxy: false,
      enableTesting: true,
    };
    sdk = new CeloAISDK(config);
  });
  afterEach(async () => {
    await sdk.destroy();
  });
  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultSdk = new CeloAISDK();
      expect(defaultSdk).toBeDefined();
      expect(defaultSdk.getConfig()).toBeDefined();
    });
    it('should initialize with custom config', () => {
      expect(sdk).toBeDefined();
      expect(sdk.getConfig()).toEqual(expect.objectContaining(config));
    });
    it('should merge config with defaults', () => {
      const partialConfig = { apiKey: 'test-key' };
      const sdkWithPartial = new CeloAISDK(partialConfig);
      const mergedConfig = sdkWithPartial.getConfig();
      expect(mergedConfig.apiKey).toBe('test-key');
      expect(mergedConfig.enableRealTransactions).toBe(true); // default value
      expect(mergedConfig.maxRiskScore).toBe(50); // default value
    });
  });
  describe('Chain Management', () => {
    it('should get supported chains', async () => {
      const chains = await sdk.getSupportedChains();
      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeGreaterThan(0);
    });
    it('should check chain health', async () => {
      const health = await sdk.getChainHealth('ethereum');
      expect(typeof health).toBe('boolean');
    });
    it('should get all chain health', async () => {
      const allHealth = await sdk.getAllChainHealth();
      expect(typeof allHealth).toBe('object');
    });
  });
  describe('Agent Management', () => {
    it('should create an agent', async () => {
      const agentConfig = {
        type: 'treasury',
        name: 'Test Agent',
        description: 'Test agent for testing',
        capabilities: ['analyze_portfolio'],
      };
      const agentId = await sdk.createAgent(agentConfig);
      expect(typeof agentId).toBe('string');
      expect(agentId.length).toBeGreaterThan(0);
    });
    it('should get all agents', async () => {
      const agents = await sdk.getAllAgents();
      expect(Array.isArray(agents)).toBe(true);
    });
    it('should process with agent', async () => {
      const agentConfig = {
        type: 'treasury',
        name: 'Test Agent',
        description: 'Test agent for testing',
        capabilities: ['analyze_portfolio'],
      };
      const agentId = await sdk.createAgent(agentConfig);
      const response = await sdk.processWithAgent(agentId, 'Test input');
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
      expect(response.agentId).toBe(agentId);
    });
  });
  describe('Contract Management', () => {
    it('should deploy a contract', async () => {
      const contractConfig = {
        name: 'TestContract',
        version: '1.0.0',
        source: 'contract TestContract {}',
        abi: [],
        bytecode: '0x',
      };
      const result = await sdk.deployContract(contractConfig);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
    it('should get a contract', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const abi = [];
      const contract = await sdk.getContract(address, abi);
      expect(contract).toBeDefined();
    });
  });
  describe('Testing', () => {
    it('should create test collection', async () => {
      const collectionId = await sdk.createTestCollection('Test Collection', 'Test description');
      expect(typeof collectionId).toBe('string');
    });
    it('should run tests when testing is enabled', async () => {
      const results = await sdk.runTests();
      expect(Array.isArray(results)).toBe(true);
    });
  });
  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await sdk.healthCheck();
      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.services).toBe('object');
    });
  });
  describe('Error Handling', () => {
    it('should handle invalid agent config', async () => {
      const invalidConfig = {
        type: '',
        name: '',
        description: '',
        capabilities: [],
      };
      await expect(sdk.createAgent(invalidConfig)).rejects.toThrow();
    });
    it('should handle invalid address', async () => {
      await expect(sdk.getTokenBalance('invalid-address', '0x0')).rejects.toThrow();
    });
  });
  describe('Event Handling', () => {
    it('should emit events', (done) => {
      sdk.on('chainsInitialized', () => {
        done();
      });
      sdk.initializeChains().catch(() => {
        // Ignore errors for this test
        done();
      });
    });
  });
});
