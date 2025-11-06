#!/usr/bin/env node



import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('celo-ai')
  .description('CLI tool for Celo AI SDK - Multi-chain blockchain automation')
  .version('1.0.0');


async function getSDK() {
  try {
    
    const sdkPath = path.join(__dirname, '../dist/index.js');
    const sdk = await import(sdkPath);
    return sdk.CeloAISDK;
  } catch {
    try {
      
      const { CeloAISDK } = await import('@celo-ai/sdk');
      return CeloAISDK;
    } catch {
      console.error('❌ SDK not found. Please install @celo-ai/sdk first.');
      console.error('   Run: npm install @celo-ai/sdk');
      process.exit(1);
    }
  }
}


async function loadConfig() {
  const configPath = path.join(process.cwd(), '.celo-ai.config.json');
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    
    return {
      apiKey: process.env.CELO_AI_API_KEY,
      privateKey: process.env.CELO_AI_PRIVATE_KEY,
      network: process.env.CELO_AI_NETWORK || 'ethereum',
      enableMultiChain: true,
      logLevel: 'info',
    };
  }
}


async function compileSolidity(sourceCode, contractName) {
  try {
    const solc = await import('solc').catch(() => {
      throw new Error('solc package not found. Please install it: npm install solc');
    });
    
    const solcModule = solc.default || solc;
    
    let compilerVersion = '0.8.20'; // Default version
    const pragmaMatch = sourceCode.match(/pragma\s+solidity\s+([\^>=<]?\d+\.\d+\.\d+)/);
    if (pragmaMatch) {
      const versionStr = pragmaMatch[1].replace(/[\^>=<]/g, '');
      const versionParts = versionStr.split('.');
      if (versionParts.length >= 2) {
        compilerVersion = `${versionParts[0]}.${versionParts[1]}.0`;
      }
    }
    
    let compiler;
    try {
      if (typeof solcModule.setupMethods === 'object' && solcModule.setupMethods.solidity) {
        compiler = await solcModule.setupMethods.solidity.loadRemoteVersion(compilerVersion);
      } 
      else if (typeof solcModule.loadRemoteVersion === 'function') {
        compiler = await solcModule.loadRemoteVersion(compilerVersion);
      }
      else if (typeof solcModule.compile === 'function') {
        compiler = solcModule;
      } else {
        throw new Error('Unable to initialize Solidity compiler. Please ensure solc is properly installed.');
      }
    } catch (loadError) {
      if (typeof solcModule.compile === 'function') {
        compiler = solcModule;
      } else {
        throw new Error(`Failed to load Solidity compiler version ${compilerVersion}: ${loadError.message}`);
      }
    }
    
    let actualContractName = contractName;
    if (!actualContractName) {
      const contractMatch = sourceCode.match(/contract\s+(\w+)/);
      if (contractMatch) {
        actualContractName = contractMatch[1];
      } else {
        throw new Error('Could not determine contract name. Please specify it with --name option.');
      }
    }
    
    const input = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: sourceCode,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode'],
          },
        },
        optimizer: {
          enabled: false,
          runs: 200,
        },
      },
    };
    
    const inputJSON = JSON.stringify(input);
    let compileOutput;
    
    if (typeof compiler.compile === 'function') {
      compileOutput = compiler.compile(inputJSON);
    } else {
      throw new Error('Compiler does not have a compile method');
    }
    
    const output = typeof compileOutput === 'string' ? JSON.parse(compileOutput) : compileOutput;
    
    if (output.errors && Array.isArray(output.errors)) {
      const errors = output.errors.filter(
        (error) => error.severity === 'error'
      );
      if (errors.length > 0) {
        const errorMessages = errors.map((e) => {
          if (e.formattedMessage) return e.formattedMessage;
          if (e.message) return e.message;
          return JSON.stringify(e);
        }).join('\n');
        throw new Error(`Compilation errors:\n${errorMessages}`);
      }
    }
    
    const contracts = output.contracts?.['contract.sol'];
    if (!contracts) {
      throw new Error('No contracts found in compilation output. Check for compilation errors.');
    }
    
    if (!contracts[actualContractName]) {
      const availableContracts = Object.keys(contracts).join(', ');
      throw new Error(`Contract "${actualContractName}" not found in compiled output. Available contracts: ${availableContracts || 'none'}`);
    }
    
    const contract = contracts[actualContractName];
    const abi = contract.abi;
    const bytecode = contract.evm?.bytecode?.object || contract.evm?.bytecode || '';
    
    if (!abi) {
      throw new Error('Failed to extract ABI from compilation output.');
    }
    
    if (!bytecode || bytecode === '0x') {
      throw new Error('Failed to extract bytecode from compilation output. Contract may be abstract or an interface.');
    }
    
    return {
      abi,
      bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
    };
  } catch (error) {
    if (error.message.includes('solc package not found')) {
      throw error;
    }
    throw new Error(`Solidity compilation failed: ${error.message}`);
  }
}


program
  .command('init')
  .description('Initialize SDK configuration')
  .option('-k, --api-key <key>', 'API key')
  .option('-p, --private-key <key>', 'Private key')
  .option('-n, --network <network>', 'Network name (default: ethereum)')
  .action(async (options) => {
    try {
      const configPath = path.join(process.cwd(), '.celo-ai.config.json');
      const config = {
        apiKey: options.apiKey || process.env.CELO_AI_API_KEY || '',
        privateKey: options.privateKey || process.env.CELO_AI_PRIVATE_KEY || '',
        network: options.network || 'ethereum',
        enableMultiChain: true,
        logLevel: 'info',
      };

      const configContent = JSON.stringify(config, null, 2);
      
      let fileHandle;
      try {
        fileHandle = await fs.open(configPath, 'wx', 0o600); // 'wx' = write exclusive, fails if exists
      } catch (openError) {
        if (openError.code === 'EEXIST') {
          fileHandle = await fs.open(configPath, 'w', 0o600);
        } else {
          throw openError;
        }
      }
      
      try {
        const buffer = Buffer.from(configContent, 'utf-8');
        await fileHandle.write(buffer, 0, buffer.length);
      } catch (writeError) {
        await fileHandle.close().catch(() => {});
        console.error('❌ Failed to write configuration file:', writeError.message);
        process.exit(1);
      } finally {
        await fileHandle.close();
      }
      
      try {
        await fs.chmod(configPath, 0o600);
      } catch (chmodError) {
        console.error('❌ Failed to set restrictive file permissions:', chmodError.message);
        console.error('   The configuration file was created but may not be properly secured.');
        console.error('   Please manually set file permissions to owner read/write only (chmod 600).');
        await fs.unlink(configPath).catch(() => {}); // Clean up on failure
        process.exit(1);
      }

      console.log('✅ Configuration file created at:', configPath);
      
      console.log('\n⚠️  SECURITY WARNING:');
      console.log('   This file contains sensitive private keys and API credentials.');
      console.log('   Keep this file secure and never commit it to version control.');
      console.log('   File permissions have been set to owner read/write only (600).');

      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const configFileName = '.celo-ai.config.json';
      
      try {
        let gitignoreContent = '';
        try {
          gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
        }

        const ignorePatterns = gitignoreContent.split('\n').map(line => line.trim());
        const isIgnored = ignorePatterns.some(pattern => {
          if (!pattern || pattern.startsWith('#')) return false;
          return pattern === configFileName || 
                 pattern === `/${configFileName}` ||
                 pattern.endsWith(configFileName);
        });

        if (!isIgnored) {
          const separator = gitignoreContent && !gitignoreContent.endsWith('\n') ? '\n' : '';
          const newEntry = `${separator}# Celo AI SDK configuration (contains sensitive keys)\n${configFileName}\n`;
          await fs.appendFile(gitignorePath, newEntry);
          console.log(`\n✅ Added ${configFileName} to .gitignore`);
        } else {
          console.log(`\n✅ ${configFileName} is already in .gitignore`);
        }
      } catch (gitignoreError) {
        console.warn(`\n⚠️  Warning: Could not update .gitignore: ${gitignoreError.message}`);
        console.warn(`   Please manually add "${configFileName}" to your .gitignore file`);
        console.warn(`   to prevent accidentally committing sensitive credentials.`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize configuration:', error.message);
      process.exit(1);
    }
  });


const chainCmd = program
  .command('chain')
  .description('Chain management commands');

chainCmd
  .command('list')
  .description('List all supported chains')
  .action(async () => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();
      
      const chains = await sdk.getSupportedChains();
      console.log('\n📋 Supported Chains:');
      console.table(chains.map(chain => ({
        ID: chain.id,
        Name: chain.name,
        ChainID: chain.chainId,
        Testnet: chain.isTestnet ? 'Yes' : 'No',
      })));
    } catch (error) {
      console.error('❌ Failed to list chains:', error.message);
      process.exit(1);
    }
  });

chainCmd
  .command('health [chainId]')
  .description('Check chain health')
  .action(async (chainId) => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      if (chainId) {
        const healthy = await sdk.getChainHealth(chainId);
        console.log(`\n🔍 Chain "${chainId}": ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      } else {
        const health = await sdk.getAllChainHealth();
        console.log('\n🔍 Chain Health Status:');
        console.table(Object.entries(health).map(([id, healthy]) => ({
          Chain: id,
          Status: healthy ? '✅ Healthy' : '❌ Unhealthy',
        })));
      }
    } catch (error) {
      console.error('❌ Failed to check chain health:', error.message);
      process.exit(1);
    }
  });


const agentCmd = program
  .command('agent')
  .description('AI agent management commands');

agentCmd
  .command('create')
  .description('Create a new AI agent')
  .requiredOption('-t, --type <type>', 'Agent type')
  .requiredOption('-n, --name <name>', 'Agent name')
  .option('-d, --description <desc>', 'Agent description')
  .option('-c, --capabilities <caps>', 'Comma-separated capabilities')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();
      
      const agentId = await sdk.createAgent({
        type: options.type,
        name: options.name,
        description: options.description || '',
        capabilities: options.capabilities ? options.capabilities.split(',') : [],
      });

      console.log(`\n✅ Agent created successfully!`);
      console.log(`   Agent ID: ${agentId}`);
    } catch (error) {
      console.error('❌ Failed to create agent:', error.message);
      process.exit(1);
    }
  });

agentCmd
  .command('list')
  .description('List all agents')
  .action(async () => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      const agents = await sdk.getAllAgents();
      console.log(`\n📋 Agents (${agents.length}):`);
      if (agents.length === 0) {
        console.log('   No agents found.');
      } else {
        console.table(agents);
      }
    } catch (error) {
      console.error('❌ Failed to list agents:', error.message);
      process.exit(1);
    }
  });

agentCmd
  .command('query <agentId> <query>')
  .description('Query an agent')
  .action(async (agentId, query) => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      console.log(`\n🤖 Querying agent "${agentId}"...`);
      const response = await sdk.processWithAgent(agentId, query);

      console.log('\n📝 Response:');
      console.log(`   Success: ${response.success}`);
      console.log(`   Response: ${response.response}`);
      if (response.reasoning) {
        console.log(`   Reasoning: ${response.reasoning}`);
      }
      const confidenceValue = (typeof response.confidence === 'number' && Number.isFinite(response.confidence))
        ? `${(response.confidence * 100).toFixed(2)}%`
        : 'N/A';
      console.log(`   Confidence: ${confidenceValue}`);
      const executionTimeValue = (typeof response.executionTime === 'number' && Number.isFinite(response.executionTime))
        ? `${response.executionTime}ms`
        : 'N/A';
      console.log(`   Execution Time: ${executionTimeValue}`);
    } catch (error) {
      console.error('❌ Failed to query agent:', error.message);
      process.exit(1);
    }
  });


const txCmd = program
  .command('tx')
  .description('Transaction commands');

txCmd
  .command('send')
  .description('Send a transaction')
  .requiredOption('-t, --to <address>', 'Recipient address')
  .option('-v, --value <value>', 'Value in wei')
  .option('-d, --data <data>', 'Transaction data')
  .option('-c, --chain <chain>', 'Chain ID')
  .action(async (options) => {
    try {
      const addressPattern = /^0x[a-fA-F0-9]{40}$/;
      if (!addressPattern.test(options.to)) {
        console.error('❌ Invalid recipient address format.');
        console.error('   Expected format: 0x followed by 40 hexadecimal characters');
        console.error(`   Received: ${options.to}`);
        process.exit(1);
      }

      if (options.value !== undefined && options.value !== null) {
        const valueStr = String(options.value).trim();
        if (valueStr === '' || isNaN(valueStr)) {
          console.error('❌ Invalid value format.');
          console.error('   Value must be a valid numeric string that can be safely parsed.');
          console.error(`   Received: ${options.value}`);
          process.exit(1);
        }

        try {
          BigInt(valueStr);
        } catch (bigIntError) {
          console.error('❌ Invalid value format.');
          console.error('   Value must be a valid number that can be safely parsed to BigInt.');
          console.error(`   Received: ${options.value}`);
          console.error(`   Error: ${bigIntError.message}`);
          process.exit(1);
        }

        const numValue = Number(valueStr);
        if (!Number.isFinite(numValue) || numValue < 0) {
          console.error('❌ Invalid value format.');
          console.error('   Value must be a finite, non-negative number.');
          console.error(`   Received: ${options.value}`);
          process.exit(1);
        }
      }

      console.log('\n📋 Transaction Details:');
      console.log(`   To: ${options.to}`);
      if (options.value !== undefined && options.value !== null) {
        console.log(`   Value: ${options.value} wei`);
      }
      if (options.data !== undefined && options.data !== null) {
        console.log(`   Data: ${options.data}`);
      }
      if (options.chain !== undefined && options.chain !== null) {
        console.log(`   Chain: ${options.chain}`);
      } else {
        console.log(`   Chain: (default)`);
      }

      const rl = readline.createInterface({ input, output });
      try {
        await rl.question('\n⚠️  Press Enter to confirm and send the transaction (Ctrl+C to cancel): ');
        rl.close();
      } catch (promptError) {
        rl.close();
        if (promptError.code === 'SIGINT' || promptError.name === 'AbortError') {
          console.log('\n\n❌ Transaction cancelled by user.');
          process.exit(1);
        }
        throw promptError;
      }

      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      console.log('\n📤 Sending transaction...');
      const response = await sdk.sendTransaction(
        {
          to: options.to,
          value: options.value,
          data: options.data,
        },
        options.chain
      );

      if (response.success) {
        console.log('\n✅ Transaction sent successfully!');
        console.log(`   Transaction Hash: ${response.txHash}`);
        if (response.blockNumber) {
          console.log(`   Block Number: ${response.blockNumber}`);
        }
      } else {
        console.error('\n❌ Transaction failed:', response.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to send transaction:', error.message);
      process.exit(1);
    }
  });


const contractCmd = program
  .command('contract')
  .description('Contract management commands');

contractCmd
  .command('deploy')
  .description('Deploy a contract')
  .requiredOption('-n, --name <name>', 'Contract name')
  .requiredOption('-s, --source <file>', 'Source file path')
  .option('-v, --version <version>', 'Contract version (default: 1.0.0)')
  .option('-c, --chain <chain>', 'Chain ID')
  .action(async (options) => {
    try {
      let source;
      try {
        source = await fs.readFile(options.source, 'utf-8');
      } catch (fileError) {
        console.error('❌ Failed to read source file.');
        console.error(`   File: ${options.source}`);
        console.error(`   Error: ${fileError.message}`);
        process.exit(1);
      }

      if (!source || source.trim().length === 0) {
        console.error('❌ Source file is empty.');
        console.error(`   File: ${options.source}`);
        process.exit(1);
      }

      console.log('\n🔨 Compiling contract...');
      let abi, bytecode;
      try {
        const compilation = await compileSolidity(source, options.name);
        abi = compilation.abi;
        bytecode = compilation.bytecode;
        console.log('✅ Compilation successful');
      } catch (compileError) {
        console.error('❌ Contract compilation failed.');
        console.error(`   ${compileError.message}`);
        if (compileError.message.includes('solc package not found')) {
          console.error('\n   To fix this, run: npm install solc');
        }
        process.exit(1);
      }

      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      console.log('\n📦 Deploying contract...');
      const deployment = await sdk.deployContract(
        {
          name: options.name,
          version: options.version || '1.0.0',
          source,
          abi,
          bytecode,
        },
        options.chain
      );

      if (deployment.success) {
        console.log('\n✅ Contract deployed successfully!');
        console.log(`   Contract Address: ${deployment.contractAddress}`);
        console.log(`   Transaction Hash: ${deployment.txHash}`);
      } else {
        console.error('\n❌ Contract deployment failed:', deployment.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to deploy contract:', error.message);
      process.exit(1);
    }
  });


program
  .command('health')
  .description('Check SDK health')
  .action(async () => {
    try {
      const config = await loadConfig();
      const CeloAISDK = await getSDK();
      const sdk = new CeloAISDK(config);
      await sdk.initialize();

      const health = await sdk.healthCheck();
      console.log('\n🏥 SDK Health Status:');
      console.log(`   Overall: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log('\n   Services:');
      for (const [service, status] of Object.entries(health.services)) {
        console.log(`     ${service}: ${status ? '✅' : '❌'}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  });


program.parse(process.argv);
