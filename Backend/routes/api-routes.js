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
import { ValidationError, NotFoundError, ServiceUnavailableError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { getRequestId } from '../utils/request-id.js';
import { schemas } from '../middleware/validation.js';

const DEFAULT_CHAIN_ID = 'ethereum';

const DEFAULT_TIMESTAMP = () => new Date().toISOString();

const createSuccessResponse = (data = {}, req = null) => ({
  success: true,
  timestamp: new Date().toISOString(),
  requestId: req ? getRequestId(req) : undefined,
  data,
});

const createErrorResponse = (statusCode, message, req = null) => ({
  success: false,
  error: {
    message,
    code: getErrorCode(statusCode),
    statusCode,
    requestId: req ? getRequestId(req) : undefined,
    timestamp: new Date().toISOString(),
  },
});

const getErrorCode = (statusCode) => {
  const codes = {
    400: 'VALIDATION_ERROR',
    401: 'AUTHENTICATION_ERROR',
    403: 'AUTHORIZATION_ERROR',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_SERVER_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codes[statusCode] || 'UNKNOWN_ERROR';
};

const validateRequired = (obj, fields) => {
  const missing = fields.filter(field => !(Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== undefined && obj[field] !== null));
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`, { missing });
  }
};

const validateAddress = (address) => {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid Ethereum address format', { address });
  }
};

const validateHexString = (str, name = 'value') => {
  if (!str || !/^0x[a-fA-F0-9]+$/.test(str)) {
    throw new ValidationError(`Invalid hex string format for ${name}`, { [name]: str });
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
    logger.debug('Retrieved all chains', { requestId: getRequestId(req), count: chains.length });
    res.json(createSuccessResponse({ chains }, req));
  }));

  router.get('/chains/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const health = await multiChainConfig.checkAllChainsHealth();
    res.json(createSuccessResponse({ chains: health }, req));
  }));

  router.get('/chains/:chainId/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const { chainId } = req.params;
    const health = await multiChainConfig.checkChainHealth(chainId);
    res.json(createSuccessResponse({ chainId, health }, req));
  }));

  router.post('/chains/select', standardRateLimiter, asyncHandler(async (req, res) => {
    const { operation, preferences } = req.body;
    validateRequired({ operation }, ['operation']);
    const bestChain = multiChainConfig.getBestChainForOperation(operation, preferences);
    res.json(createSuccessResponse({ selectedChain: bestChain }, req));
  }));

  router.post('/contracts/deploy', transactionRateLimiter, asyncHandler(async (req, res) => {
    const { contractConfig, chainId = DEFAULT_CHAIN_ID } = req.body;
    validateRequired({ contractConfig }, ['contractConfig']);
    const deployment = await contractFactory.deployContract(contractConfig, chainId);
    res.json(createSuccessResponse(deployment, req));
  }));

  router.get('/contracts', standardRateLimiter, asyncHandler(async (req, res) => {
    const { chainId } = req.query;
    const contracts = await contractFactory.getDeployedContracts(chainId || null);
    res.json(createSuccessResponse({ contracts }, req));
  }));

  router.get('/contracts/:address', standardRateLimiter, asyncHandler(async (req, res) => {
    const { address } = req.params;
    const { abi, abiUrl, chainId = DEFAULT_CHAIN_ID } = req.query;
    
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
      return res.status(400).json(createErrorResponse(400, 'Either abi or abiUrl query parameter is required', req));
    }
    
    let parsedAbi;
    try {
      if (abiUrl) {
        const url = new URL(abiUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are allowed');
        }
        
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
      return res.status(400).json(createErrorResponse(400, `Invalid ABI: ${error.message}`, req));
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
    res.json(createSuccessResponse({ contract: contractInfo }, req));
  }));

  router.get('/monitoring/system', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.system;
    res.json(createSuccessResponse({ metrics }, req));
  }));

  router.get('/monitoring/application', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.application;
    res.json(createSuccessResponse({ metrics }, req));
  }));

  router.get('/monitoring/performance', standardRateLimiter, asyncHandler(async (req, res) => {
    const metrics = monitoringSystem.metrics.performance;
    res.json(createSuccessResponse({ metrics }, req));
  }));

  router.get('/monitoring/logs', standardRateLimiter, asyncHandler(async (req, res) => {
    const { limit = 100 } = req.query;
    const logs = Array.isArray(monitoringSystem.logs) 
      ? monitoringSystem.logs.slice(-Number(limit)) 
      : [];
    res.json(createSuccessResponse({ logs }, req));
  }));

  router.get('/monitoring/alerts', standardRateLimiter, asyncHandler(async (req, res) => {
    const alerts = monitoringSystem.alerts || [];
    res.json(createSuccessResponse({ alerts }, req));
  }));

  router.get('/monitoring/health', standardRateLimiter, asyncHandler(async (req, res) => {
    const health = monitoringSystem.getHealthStatus();
    res.json(createSuccessResponse(health, req));
  }));

  router.get('/testing/collections', standardRateLimiter, asyncHandler(async (req, res) => {
    const collections = await postmanProtocol.getCollections();
    res.json(createSuccessResponse({ collections }, req));
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
    res.json(createSuccessResponse({ collectionId }, req));
  }));

  router.get('/testing/collections/:collectionId', standardRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const collection = await postmanProtocol.getCollection(collectionId);
    res.json(createSuccessResponse({ collection }, req));
  }));

  router.post('/testing/collections/:collectionId/tests', standardRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const test = req.body;
    validateRequired({ test }, ['test']);
    res.json(createSuccessResponse({ testId: test.id }, req));
  }));

  router.delete('/testing/collections/:collectionId/tests/:testId', standardRateLimiter, asyncHandler(async (req, res) => {
    res.json(createSuccessResponse({}, req));
  }));

  router.post('/testing/collections/:collectionId/run', strictRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId } = req.params;
    const results = await postmanProtocol.runCollectionTests(collectionId);
    res.json(createSuccessResponse({ results }, req));
  }));

  router.post('/testing/collections/:collectionId/tests/:testId/run', strictRateLimiter, asyncHandler(async (req, res) => {
    const { collectionId, testId } = req.params;
    const { environmentId } = req.query;
    
    const result = await postmanProtocol.runTest(collectionId, testId, environmentId || null);
    res.json(createSuccessResponse({ result }, req));
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
            'Private key is required to send transaction. Provide privateKey in request body.',
            req
          ));
        }
        
        const safeBigInt = (value, fieldName) => {
          try {
            return value ? BigInt(value) : undefined;
          } catch (error) {
            throw new Error(`Invalid ${fieldName}: must be a valid integer`);
          }
        };
        
        const txParams = {
          to: transaction.to,
          value: safeBigInt(transaction.value, 'value'),
          data: transaction.data || undefined,
          gas: safeBigInt(transaction.gasLimit, 'gasLimit'),
          gasPrice: safeBigInt(transaction.gasPrice, 'gasPrice'),
          maxFeePerGas: safeBigInt(transaction.maxFeePerGas, 'maxFeePerGas'),
          maxPriorityFeePerGas: safeBigInt(transaction.maxPriorityFeePerGas, 'maxPriorityFeePerGas'),
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
          'Invalid transaction format. Transaction must be a hex string or an object.',
          req
        ));
      }
      
      res.json(createSuccessResponse({ txHash }, req));
    } catch (error) {
      logger.error('Transaction send error', {
        error: error.message,
        stack: error.stack,
        chainId,
        transaction: sanitizeTransaction(transaction),
        requestId: getRequestId(req)
      });
      
      const statusCode = error.statusCode || error.status || 500;
      res.status(statusCode).json(createErrorResponse(
        statusCode,
        error.message || 'Failed to send transaction',
        req
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
      
      res.json(createSuccessResponse(status, req));
    } catch (error) {
      logger.error('Transaction status error', {
        error: error.message,
        txHash,
        chainId,
        requestId: getRequestId(req)
      });
      
      res.status(404).json(createErrorResponse(
        404,
        `Transaction not found: ${error.message}`,
        req
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
          balance: (Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18).toFixed(6),
          raw: balance.toString(),
          decimals: 18,
          symbol: 'ETH',
          address: tokenAddress,
        };
        res.json(createSuccessResponse(balanceObj, req));
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
        const wholePart = balance / divisor;
        const fractionalPart = balance % divisor;
        const formattedBalance = (Number(wholePart) + Number(fractionalPart) / Number(divisor)).toFixed(6);
        
        const balanceObj = {
          success: true,
          balance: formattedBalance,
          raw: balance.toString(),
          decimals: Number(decimals),
          symbol: symbol || 'UNKNOWN',
          address: tokenAddress,
        };
        
        res.json(createSuccessResponse(balanceObj, req));
      }
    } catch (error) {
      logger.error('Token balance error', {
        error: error.message,
        address,
        tokenAddress,
        chainId,
        requestId: getRequestId(req)
      });
      
      res.status(500).json(createErrorResponse(
        500,
        `Failed to fetch balance: ${error.message}`,
        req
      ));
    }
  }));

  router.get('/agents', standardRateLimiter, asyncHandler(async (req, res) => {
    const agents = automationSystem?.aiAgentSystem?.getAgents() || [];
    res.json(createSuccessResponse({ agents }, req));
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
    res.json(createSuccessResponse({ agent }, req));
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
    }, req));
  }));

  router.post('/code-generator/generate', strictRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available', req));
    }
    const { description, name, language, options } = req.body;
    validateRequired({ description, name }, ['description', 'name']);
    const result = await automationSystem.codeGenerator.generateCode({
      description,
      name,
      language,
      options
    });
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/code-generator/compile', strictRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available', req));
    }
    const { source, name } = req.body;
    validateRequired({ source, name }, ['source', 'name']);
    const result = await automationSystem.codeGenerator.compileCode({ source, name });
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/code-generator/deploy', transactionRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available', req));
    }
    const { bytecode, name, constructorArgs } = req.body;
    validateRequired({ bytecode, name }, ['bytecode', 'name']);
    const result = await automationSystem.codeGenerator.deployContract({
      bytecode,
      name,
      constructorArgs
    });
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/code-generator/generate-and-deploy', transactionRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.codeGenerator) {
      return res.status(503).json(createErrorResponse(503, 'Code Generator not available', req));
    }
    const result = await automationSystem.codeGenerator.generateAndDeploy(req.body);
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/rebalancer/analyze', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available', req));
    }
    const result = await automationSystem.rebalancerSystem.analyzePortfolio(req.body);
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/rebalancer/rebalance', transactionRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available', req));
    }
    const result = await automationSystem.rebalancerSystem.rebalancePortfolio(req.body);
    res.json(createSuccessResponse(result, req));
  }));

  router.get('/rebalancer/portfolio/:walletAddress', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available', req));
    }
    const { walletAddress } = req.params;
    validateAddress(walletAddress);
    const portfolio = automationSystem.rebalancerSystem.getPortfolio(walletAddress);
    if (!portfolio) {
      return res.status(404).json(createErrorResponse(404, 'Portfolio not found', req));
    }
    res.json(createSuccessResponse(portfolio, req));
  }));

  router.get('/rebalancer/history', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available', req));
    }
    const { walletAddress } = req.query;
    const history = automationSystem.rebalancerSystem.getRebalanceHistory(walletAddress);
    res.json(createSuccessResponse({ history }, req));
  }));

  router.post('/rebalancer/yield-opportunities', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.rebalancerSystem) {
      return res.status(503).json(createErrorResponse(503, 'Rebalancer System not available', req));
    }
    const result = await automationSystem.rebalancerSystem.findYieldOpportunities(req.body);
    res.json(createSuccessResponse(result, req));
  }));

  router.get('/environment/tools', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available', req));
    }
    const tools = automationSystem.environmentManager.getTools();
    res.json(createSuccessResponse({ tools }, req));
  }));

  router.get('/environment/tools/:toolId', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available', req));
    }
    const { toolId } = req.params;
    const tool = automationSystem.environmentManager.getTool(toolId);
    if (!tool) {
      return res.status(404).json(createErrorResponse(404, 'Tool not found', req));
    }
    res.json(createSuccessResponse(tool, req));
  }));

  router.post('/environment/tools/:toolId/execute', standardRateLimiter, validateToolExecution(automationSystem), asyncHandler(async (req, res) => {
    const { toolId } = req.params;
    const { parameters } = req.body;
    const result = await automationSystem.environmentManager.executeTool(toolId, parameters);
    res.json(createSuccessResponse(result, req));
  }));

  router.post('/environment/route', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available', req));
    }
    const result = await automationSystem.environmentManager.routeRequest(req.body);
    res.json(createSuccessResponse(result, req));
  }));

  router.get('/environment/stats', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available', req));
    }
    const stats = automationSystem.environmentManager.getStats();
    res.json(createSuccessResponse(stats, req));
  }));

  router.get('/environment/health', standardRateLimiter, asyncHandler(async (req, res) => {
    if (!automationSystem?.environmentManager) {
      return res.status(503).json(createErrorResponse(503, 'Environment Manager not available', req));
    }
    const health = automationSystem.environmentManager.getHealth();
    res.json(createSuccessResponse(health, req));
  }));

  router.get('/health', asyncHandler(async (req, res) => {
    const health = {
      healthy: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
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
      version: '2.0.0',
    };
    res.json(createSuccessResponse(health, req));
  }));

  return router;
}

export default createApiRoutes;
