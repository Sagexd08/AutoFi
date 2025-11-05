import express from 'express';
import { MultiChainConfig } from '../multi-chain-config.js';
import { ProxyServer } from '../proxy-server.js';
import { ContractFactory } from '../contract-factory.js';
import { MonitoringSystem } from '../monitoring-system.js';
import PostmanProtocol from '../postman-protocol.js';
import { validateToolExecution } from './tool-validation-middleware.js';
import {
  standardRateLimiter,
  strictRateLimiter,
  transactionRateLimiter,
  agentRateLimiter,
  authRateLimiter,
} from '../middleware/rate-limit.js';
import { asyncHandler } from '../middleware/error-handler.js';

const DEFAULT_CHAIN_ID = 'ethereum';
const DEFAULT_TIMESTAMP = () => new Date().toISOString();

const createErrorResponse = (statusCode, error, timestamp = DEFAULT_TIMESTAMP()) => ({
  success: false,
  error,
  timestamp,
});

const createSuccessResponse = (data = {}, timestamp = DEFAULT_TIMESTAMP()) => ({
  success: true,
  timestamp,
  data,
});

const validateRequired = (obj, fields) => {
  const missing = fields.filter(field => !(Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== undefined && obj[field] !== null));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

const validateAddress = (address) => {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address format');
  }
};

const validateHexString = (str, name = 'value') => {
  if (!str || !/^0x[a-fA-F0-9]+$/.test(str)) {
    throw new Error(`Invalid hex string format for ${name}`);
  }
};

const sanitizeTransaction = (transaction) => {
  if (typeof transaction === 'object' && transaction.data) {
    return { ...transaction, data: '0x...' };
  }
  return typeof transaction === 'object' ? transaction : 'raw';
};

export function createApiRoutes(automationSystem = null) {
  const router = express.Router();
  
  const multiChainConfig = automationSystem?.multiChainConfig || new MultiChainConfig();
  const contractFactory = automationSystem?.contractFactory || new ContractFactory(multiChainConfig);
  const monitoringSystem = automationSystem?.monitoringSystem || new MonitoringSystem();
  const postmanProtocol = automationSystem?.postmanProtocol || new PostmanProtocol({
    apiKey: process.env.POSTMAN_API_KEY,
  });

  router.get('/chains', standardRateLimiter, asyncHandler(async (req, res) => {
    const chains = multiChainConfig.getAllChains();
    res.json(createSuccessResponse({ chains }));
  }));

  router.get('/chains/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const health = await multiChainConfig.checkAllChainsHealth();
    res.json(createSuccessResponse({ chains: health }));
  }));

  router.get('/chains/:chainId/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const { chainId } = req.params;
    const health = await multiChainConfig.checkChainHealth(chainId);
    res.json(createSuccessResponse({ chainId, health }));
  }));

  router.post('/chains/select', standardRateLimiter, asyncHandler(async (req, res) => {
    const { operation, preferences } = req.body;
    validateRequired({ operation }, ['operation']);
    const bestChain = multiChainConfig.getBestChainForOperation(operation, preferences);
    res.json(createSuccessResponse({ selectedChain: bestChain }));
  }));

  router.post('/contracts/deploy', transactionRateLimiter, asyncHandler(async (req, res) => {
    const { contractConfig, chainId = DEFAULT_CHAIN_ID } = req.body;
    validateRequired({ contractConfig }, ['contractConfig']);
    const deployment = await contractFactory.deployContract(contractConfig, chainId);
    res.json(createSuccessResponse(deployment));
  }));

  router.get('/contracts', standardRateLimiter, asyncHandler(async (req, res) => {
    const { chainId } = req.query;
    const contracts = await contractFactory.getDeployedContracts(chainId || null);
    res.json(createSuccessResponse({ contracts }));
  }));

  router.get('/contracts/:address', standardRateLimiter, asyncHandler(async (req, res) => {
    const { address } = req.params;
    const { abi, abiUrl, chainId = DEFAULT_CHAIN_ID } = req.query;
    
    // Coerce boolean query parameters explicitly (query params are strings, so 'false' is truthy)
    const includeBytecodeFlag = req.query.includeBytecode !== undefined 
      ? (String(req.query.includeBytecode).toLowerCase() === 'true' || req.query.includeBytecode === '1')
      : false;
    const includeMetadataFlag = req.query.includeMetadata !== undefined
      ? (String(req.query.includeMetadata).toLowerCase() === 'true' || req.query.includeMetadata === '1')
      : true;
    const includeAnalysisFlag = req.query.includeAnalysis !== undefined
      ? (String(req.query.includeAnalysis).toLowerCase() === 'true' || req.query.includeAnalysis === '1')
      : true;
    
    validateAddress(address);
    
    if (!abi && !abiUrl) {
      return res.status(400).json(createErrorResponse(400, 'Either abi or abiUrl query parameter is required'));
    }
    
    let parsedAbi;
    try {
      if (abiUrl) {
        // Validate URL scheme and prevent internal network access
        const url = new URL(abiUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are allowed');
        }
        
        // Block common internal network ranges
        const hostname = url.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('192.168.') ||
          hostname === '169.254.169.254' // AWS metadata
        ) {
          throw new Error('Internal network URLs are not allowed');
        }

        let fetch;
        try {
          fetch = (await import('node-fetch')).default;
        } catch {
          fetch = globalThis.fetch;
        }
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        let abiData;
        try {
          const response = await fetch(abiUrl, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'AutoFi-Backend' }
          });
          clearTimeout(timeout);
        
          if (!response.ok) {
            throw new Error(`Failed to fetch ABI from URL: ${response.statusText}`);
          }
          
          abiData = await response.json();
        } catch (error) {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            throw new Error('ABI fetch timeout after 5 seconds');
          }
          throw error;
        }
        
        parsedAbi = Array.isArray(abiData) ? abiData : (abiData.abi || abiData.result || abiData);
      } else {
        parsedAbi = typeof abi === 'string' ? JSON.parse(abi) : abi;
      }
      
      if (!Array.isArray(parsedAbi)) {
        throw new Error('ABI must be an array');
      }
    } catch (error) {
      return res.status(400).json(createErrorResponse(400, `Invalid ABI: ${error.message}`));
    }
    
    const client = await multiChainConfig.createChainClient(chainId);
    
    const contractInfo = {
      address: address.toLowerCase(),
      chainId,
      abi: parsedAbi,
      standard: null,
      functions: [],
      events: [],
      errors: [],
      constructor: null,
      fallback: null,
      receive: null
    };
    
    if (includeAnalysisFlag) {
      parsedAbi.forEach(item => {
        if (item.type === 'function') {
          contractInfo.functions.push({
            name: item.name,
            inputs: item.inputs || [],
            outputs: item.outputs || [],
            stateMutability: item.stateMutability || 'nonpayable',
            payable: item.stateMutability === 'payable',
            view: item.stateMutability === 'view' || item.stateMutability === 'pure',
            constant: item.constant || false
          });
        } else if (item.type === 'event') {
          contractInfo.events.push({
            name: item.name,
            inputs: item.inputs || [],
            anonymous: item.anonymous || false
          });
        } else if (item.type === 'error') {
          contractInfo.errors.push({
            name: item.name,
            inputs: item.inputs || []
          });
        } else if (item.type === 'constructor') {
          contractInfo.constructor = {
            inputs: item.inputs || [],
            payable: item.stateMutability === 'payable'
          };
        } else if (item.type === 'fallback') {
          contractInfo.fallback = {
            stateMutability: item.stateMutability || 'nonpayable',
            payable: item.stateMutability === 'payable'
          };
        } else if (item.type === 'receive') {
          contractInfo.receive = {
            stateMutability: 'payable'
          };
        }
      });
      
      const functionNames = contractInfo.functions.map(f => f.name);
      if (functionNames.includes('balanceOf') && functionNames.includes('transfer') && functionNames.includes('transferFrom')) {
        contractInfo.standard = 'ERC20';
      } else if (functionNames.includes('tokenURI') && functionNames.includes('safeTransferFrom')) {
        contractInfo.standard = 'ERC721';
      } else if (functionNames.includes('supportsInterface')) {
        contractInfo.standard = 'ERC165';
      }
    }
    
    if (includeMetadataFlag || includeBytecodeFlag) {
      try {
        const bytecode = await client.publicClient.getBytecode({ address });
        contractInfo.bytecode = includeBytecodeFlag ? bytecode : undefined;
        contractInfo.isContract = bytecode && bytecode !== '0x' && bytecode.length > 2;
        contractInfo.bytecodeLength = bytecode ? (bytecode.length - 2) / 2 : 0;
        
        if (includeMetadataFlag && contractInfo.isContract) {
          try {
            const blockNumber = await client.publicClient.getBlockNumber();
            contractInfo.currentBlock = blockNumber.toString();
            
            try {
              const balance = await client.publicClient.getBalance({ address });
              contractInfo.balance = balance.toString();
              contractInfo.balanceFormatted = (Number(balance) / 1e18).toFixed(6);
            } catch {}
            
            const deployedContracts = await contractFactory.getDeployedContracts(chainId);
            const deploymentInfo = deployedContracts.find(c => 
              c.contractAddress?.toLowerCase() === address.toLowerCase()
            );
            
            if (deploymentInfo) {
              contractInfo.deploymentInfo = {
                txHash: deploymentInfo.txHash,
                blockNumber: deploymentInfo.blockNumber,
                gasUsed: deploymentInfo.gasUsed,
                deployedAt: deploymentInfo.deploymentTime
              };
            }
          } catch (error) {
            contractInfo.metadataError = error.message;
          }
        }
      } catch (error) {
        contractInfo.bytecodeError = error.message;
        contractInfo.isContract = false;
      }
    }
    
    const contract = await contractFactory.getContract(address, parsedAbi, chainId);
    contractInfo.contract = contract;
    
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(createSuccessResponse({ contract: contractInfo }));
  }));

  router.get('/monitoring/system', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.system;
    res.json(createSuccessResponse({ metrics }));
  }));

  router.get('/monitoring/application', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.application;
    res.json(createSuccessResponse({ metrics }));
  }));

  router.get('/monitoring/performance', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.performance;
    res.json(createSuccessResponse({ metrics }));
  }));

  router.get('/monitoring/logs', standardRateLimiter, asyncHandler(async (req, res) => {
    const { limit = 100 } = req.query;
    const logs = Array.isArray(monitoringSystem.logs) 
      ? monitoringSystem.logs.slice(-Number(limit)) 
      : [];
    res.json(createSuccessResponse({ logs }));
  }));

  router.get('/monitoring/alerts', standardRateLimiter, asyncHandler(async (req, res) => {
    const alerts = monitoringSystem.alerts || [];
    res.json(createSuccessResponse({ alerts }));
  }));

  router.get('/monitoring/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const health = monitoringSystem.getHealthStatus();
    res.json(createSuccessResponse(health));
  }));

  router.get('/testing/collections', standardRateLimiter, asyncHandler(async (req, res) => {
    const collections = await postmanProtocol.getCollections();
    res.json(createSuccessResponse({ collections }));
  }));

  router.post('/testing/collections', standardRateLimiter, asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    validateRequired({ name }, ['name']);
    const collectionId = await postmanProtocol.createCollection({
      info: {
        name,
        description: description || '',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [],
    });
    res.json(createSuccessResponse({ collectionId }));
  }));

  router.get('/testing/collections/:collectionId', standardRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const collection = await postmanProtocol.getCollection(collectionId);
    res.json(createSuccessResponse({ collection }));
  }));

  router.post('/testing/collections/:collectionId/tests', standardRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const test = req.body;
    validateRequired({ test }, ['test']);
    res.json(createSuccessResponse({ testId: test.id }));
  }));

  router.delete('/testing/collections/:collectionId/tests/:testId', standardRateLimiter, asyncHandler(async (req, res) => {
    res.json(createSuccessResponse({}));
  }));

  router.post('/testing/collections/:collectionId/run', strictRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const results = await postmanProtocol.runCollectionTests(collectionId);
    res.json(createSuccessResponse({ results }));
  }));

  router.post('/testing/collections/:collectionId/tests/:testId/run', strictRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId, testId } = req.params;
    const { environmentId } = req.query;
    
    const result = await postmanProtocol.runTest(collectionId, testId, environmentId || null);
    res.json(createSuccessResponse({ result }));
  }));

  router.post('/transactions/send', transactionRateLimiter, asyncHandler(async (req, res) => {
    const { transaction, chainId = DEFAULT_CHAIN_ID, privateKey } = req.body;
    
    validateRequired({ transaction }, ['transaction']);

    try {
      const client = await multiChainConfig.createChainClient(chainId, privateKey);
      
      let txHash;
      
      if (typeof transaction === 'string' && transaction.startsWith('0x')) {
        validateHexString(transaction, 'transaction');
        txHash = await client.publicClient.sendRawTransaction({
          serializedTransaction: transaction
        });
      } else if (typeof transaction === 'object') {
        validateRequired(transaction, ['to']);
        validateAddress(transaction.to);
        
        if (transaction.value) validateHexString(transaction.value, 'value');
        if (transaction.data) validateHexString(transaction.data, 'data');
        
        if (!client.walletClient) {
          return res.status(400).json(createErrorResponse(
            400,
            'Private key is required to send transaction. Provide privateKey in request body.'
          ));
        }
        
        const txParams = {
          to: transaction.to,
          value: transaction.value ? BigInt(transaction.value) : undefined,
          data: transaction.data || undefined,
          gas: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
          gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined,
          maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? BigInt(transaction.maxPriorityFeePerGas) : undefined,
          nonce: transaction.nonce,
          chain: client.chain.viemChain
        };
        
        Object.keys(txParams).forEach(key => {
          if (txParams[key] === undefined) {
            delete txParams[key];
          }
        });
        
        txHash = await client.walletClient.sendTransaction(txParams);
      } else {
        return res.status(400).json(createErrorResponse(
          400,
          'Invalid transaction format. Transaction must be a hex string or an object.'
        ));
      }
      
      res.json(createSuccessResponse({ txHash }));
    } catch (error) {
      console.error('Transaction send error:', {
        error: error.message,
        stack: error.stack,
        chainId,
        transaction: sanitizeTransaction(transaction),
        timestamp: DEFAULT_TIMESTAMP()
      });
      
      const statusCode = error.statusCode || error.status || 500;
      res.status(statusCode).json(createErrorResponse(
        statusCode,
        error.message || 'Failed to send transaction'
      ));
    }
  }));

  router.get('/transactions/:txHash/status', standardRateLimiter, asyncHandler(async (req, res) => {
    const { txHash } = req.params;
    const { chainId = DEFAULT_CHAIN_ID } = req.query;
    
    validateHexString(txHash, 'txHash');
    
    try {
      const client = await multiChainConfig.createChainClient(chainId);
      const receipt = await client.publicClient.getTransactionReceipt({ hash: txHash });
      
      const status = {
        success: true,
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        confirmations: receipt.blockNumber ? '1+' : '0',
        transactionHash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to,
        timestamp: DEFAULT_TIMESTAMP(),
      };
      
      res.json(createSuccessResponse(status));
    } catch (error) {
      console.error('Transaction status error:', {
        error: error.message,
        txHash,
        chainId,
        timestamp: DEFAULT_TIMESTAMP()
      });
      
      res.status(404).json(createErrorResponse(
        404,
        `Transaction not found: ${error.message}`
      ));
    }
  }));

  router.get('/tokens/balance/:address', standardRateLimiter, asyncHandler(async (req, res) => {
    const { address } = req.params;
    const { tokenAddress = '0x0000000000000000000000000000000000000000', chainId = DEFAULT_CHAIN_ID } = req.query;
    
    validateAddress(address);
    validateAddress(tokenAddress);
    
    try {
      const client = await multiChainConfig.createChainClient(chainId);
      
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        const balance = await client.publicClient.getBalance({ address });
        const balanceObj = {
          success: true,
          balance: (Number(balance) / 1e18).toFixed(6),
          raw: balance.toString(),
          decimals: 18,
          symbol: 'ETH',
          address: tokenAddress,
        };
        res.json(createSuccessResponse(balanceObj));
      } else {
        const erc20Abi = [{
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }, {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }, {
          constant: true,
          inputs: [],
          name: 'symbol',
          outputs: [{ name: '', type: 'string' }],
          type: 'function'
        }];
        
        const [balance, decimals, symbol] = await Promise.all([
          client.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address]
          }),
          client.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
          client.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'symbol',
          })
        ]);
        
        const divisor = BigInt(10 ** Number(decimals));
        const balanceObj = {
          success: true,
          balance: (Number(balance) / Number(divisor)).toFixed(6),
          raw: balance.toString(),
          decimals: Number(decimals),
          symbol: symbol || 'UNKNOWN',
          address: tokenAddress,
        };
        
        res.json(createSuccessResponse(balanceObj));
      }
    } catch (error) {
      console.error('Token balance error:', {
        error: error.message,
        address,
        tokenAddress,
        chainId,
        timestamp: DEFAULT_TIMESTAMP()
      });
      
      res.status(500).json(createErrorResponse(
        500,
        `Failed to fetch balance: ${error.message}`
      ));
    }
  }));

  router.get('/agents', standardRateLimiter, asyncHandler(async (req, res) => {
    const agents = automationSystem?.aiAgentSystem?.getAgents() || [];
    res.json(createSuccessResponse({ agents }));
  }));

  router.post('/agents', agentRateLimiter, asyncHandler(async (req, res) => {
    const { type, name, description, capabilities } = req.body;
    validateRequired({ type, name }, ['type', 'name']);
    
    const agentId = automationSystem?.aiAgentSystem
      ? await automationSystem.aiAgentSystem.createAgent({ type, name, description, capabilities })
      : `agent_${Date.now()}`;
    
    const agent = {
      id: agentId,
      type,
      name,
      description,
      capabilities,
      status: 'active',
      createdAt: DEFAULT_TIMESTAMP(),
    };
    res.json(createSuccessResponse({ agent }));
  }));

  router.post('/agents/:agentId/process', agentRateLimiter, asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { input, options = {} } = req.body;
    validateRequired({ input }, ['input']);
    
    const response = automationSystem?.aiAgentSystem
      ? await automationSystem.aiAgentSystem.processWithAgent(agentId, input, options)
      : {
          response: `AI Agent response for: ${input}`,
          reasoning: 'AI reasoning process',
          confidence: 0.85,
          functionCalls: [],
          executionTime: Math.floor(Math.random() * 1000) + 100,
        };
    
    res.json(createSuccessResponse({
      ...response,
      agentId,
    }));
  }));

  router.post('/code-generator/generate', strictRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available'));
    }
    const { description, name, language, options } = req.body;
    validateRequired({ description, name }, ['description', 'name']);
    const result = await automationSystem.codeGenerator.generateCode({
      description,
      name,
      language,
      options
    });
    res.json(createSuccessResponse(result));
  }));

  router.post('/code-generator/compile', strictRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available'));
    }
    const { source, name } = req.body;
    validateRequired({ source, name }, ['source', 'name']);
    const result = await automationSystem.codeGenerator.compileCode({ source, name });
    res.json(createSuccessResponse(result));
  }));

  router.post('/code-generator/deploy', transactionRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available'));
    }
    const { source, name, chainId, constructorArgs } = req.body;
    validateRequired({ source, name }, ['source', 'name']);
    const result = await automationSystem.codeGenerator.deployCode({
      source,
      name,
      chainId,
      constructorArgs
    });
    res.json(createSuccessResponse(result));
  }));

  router.post('/code-generator/generate-and-deploy', strictRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available'));
    }
    const result = await automationSystem.codeGenerator.generateAndDeploy(req.body);
    res.json(createSuccessResponse(result));
  }));

  router.post('/rebalancer/analyze', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available'));
    }
    const result = await automationSystem.rebalancerSystem.analyzePortfolio(req.body);
    res.json(createSuccessResponse(result));
  }));

  router.post('/rebalancer/rebalance', transactionRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available'));
    }
    const result = await automationSystem.rebalancerSystem.rebalancePortfolio(req.body);
    res.json(createSuccessResponse(result));
  }));

  router.get('/rebalancer/portfolio/:walletAddress', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available'));
    }
    const { walletAddress } = req.params;
    validateAddress(walletAddress);
    const portfolio = automationSystem.rebalancerSystem.getPortfolio(walletAddress);
    if (!portfolio) {
      return res.status(404).json(createErrorResponse(404, 'Portfolio not found'));
    }
    res.json(createSuccessResponse(portfolio));
  }));

  router.get('/rebalancer/history', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available'));
    }
    const { walletAddress } = req.query;
    const history = automationSystem.rebalancerSystem.getRebalanceHistory(walletAddress);
    res.json(createSuccessResponse({ history }));
  }));

  router.post('/rebalancer/yield-opportunities', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available'));
    }
    const result = await automationSystem.rebalancerSystem.findYieldOpportunities(req.body);
    res.json(createSuccessResponse(result));
  }));

  router.get('/environment/tools', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available'));
    }
    const tools = automationSystem.environmentManager.getTools();
    res.json(createSuccessResponse({ tools }));
  }));

  router.get('/environment/tools/:toolId', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available'));
    }
    const { toolId } = req.params;
    const tool = automationSystem.environmentManager.getTool(toolId);
    if (!tool) {
      return res.status(404).json(createErrorResponse(404, 'Tool not found'));
    }
    res.json(createSuccessResponse(tool));
  }));

  router.post('/environment/tools/:toolId/execute', standardRateLimiter, validateToolExecution(automationSystem), asyncHandler(async (req, res) => {
    const { toolId } = req.params;
    const { parameters } = req.body;
    const result = await automationSystem.environmentManager.executeTool(toolId, parameters);
    res.json(createSuccessResponse(result));
  }));

  router.post('/environment/route', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available'));
    }
    const result = await automationSystem.environmentManager.routeRequest(req.body);
    res.json(createSuccessResponse(result));
  }));

  router.get('/environment/stats', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available'));
    }
    const stats = automationSystem.environmentManager.getStats();
    res.json(createSuccessResponse(stats));
  }));

  router.get('/environment/health', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available'));
    }
    const health = automationSystem.environmentManager.getHealth();
    res.json(createSuccessResponse(health));
  }));

  router.get('/health', asyncHandler(async (req, res) => {
    const health = {
      healthy: true,
      status: 'operational',
      timestamp: DEFAULT_TIMESTAMP(),
      services: {
        chains: true,
        contracts: true,
        monitoring: true,
        testing: true,
        agents: true,
        codeGenerator: !!automationSystem?.codeGenerator,
        rebalancer: !!automationSystem?.rebalancerSystem,
        environment: !!automationSystem?.environmentManager,
      },
      uptime: process.uptime(),
      version: '1.0.0',
    };
    res.json(createSuccessResponse(health));
  }));

  return router;
}

const router = createApiRoutes();
export default router;
