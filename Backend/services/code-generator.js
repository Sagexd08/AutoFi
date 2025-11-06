import { EventEmitter } from 'events';
export class CodeGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableCompilation: config.enableCompilation !== false,
      enableDeployment: config.enableDeployment !== false,
      defaultChain: config.defaultChain || 'ethereum',
      ...config
    };
    this.contractFactory = config.contractFactory || null;
    this.generationHistory = [];
    this.totalCompilations = 0;
    this.successfulCompilations = 0;
    this.failedCompilations = 0;
    this.stats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      totalCompilations: 0,
      successfulCompilations: 0,
      failedCompilations: 0
    };
  }
  setContractFactory(contractFactory) {
    this.contractFactory = contractFactory;
    this.emit('contractFactorySet', { available: !!contractFactory });
  }
  async generateCode(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { description, name, language = 'solidity', options = {} } = parameters;
    if (!description || typeof description !== 'string') {
      throw new Error('Valid description string is required for code generation');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Valid contract name string is required');
    }
    try {
      this.stats.totalGenerations++;
      this.emit('codeGenerationStarted', { name, language });
      const sourceCode = this.generateContractSource(description, name, language, options);
      const result = {
        success: true,
        name,
        language,
        source: sourceCode,
        abi: null, 
        timestamp: new Date().toISOString()
      };
      this.generationHistory.push({
        ...result,
        description,
        options
      });
      if (this.generationHistory.length > 100) {
        this.generationHistory.shift();
      }
      this.stats.successfulGenerations++;
      this.emit('codeGenerated', result);
      return result;
    } catch (error) {
      this.stats.failedGenerations++;
      this.emit('codeGenerationError', { name, error: error.message });
      throw error;
    }
  }
  _isStubSource(source) {
    if (!source || typeof source !== 'string') {
      return false;
    }
    const nonCommentLines = source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*'));
    return nonCommentLines.length === 0;
  }
  async compileCode(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { source, name, language } = parameters;
    if (!source || typeof source !== 'string') {
      throw new Error('Valid source code string is required');
    }
    if (language && language !== 'solidity') {
      throw new Error(`Language ${language} not supported`);
    }
    if (this._isStubSource(source)) {
      throw new Error('Cannot compile stub source code. Only Solidity is supported.');
    }
    if (!this.contractFactory) {
      throw new Error('ContractFactory not available');
    }
    this.totalCompilations++;
    this.stats.totalCompilations++;
    try {
      this.emit('compilationStarted', { name });
      const contractConfig = {
        name: name || 'GeneratedContract',
        source: source
      };
      const compilation = await this.contractFactory.compileContract(contractConfig);
      this.successfulCompilations++;
      this.stats.successfulCompilations++;
      const result = {
        success: true,
        name,
        abi: compilation.abi,
        bytecode: compilation.bytecode,
        timestamp: new Date().toISOString(),
        stats: {
          totalCompilations: this.totalCompilations,
          successfulCompilations: this.successfulCompilations,
          failedCompilations: this.failedCompilations
        }
      };
      this.emit('compilationCompleted', result);
      return result;
    } catch (error) {
      this.failedCompilations++;
      this.stats.failedCompilations++;
      this.emit('compilationError', { 
        name, 
        error: error.message,
        stats: {
          totalCompilations: this.totalCompilations,
          successfulCompilations: this.successfulCompilations,
          failedCompilations: this.failedCompilations
        }
      });
      throw error;
    }
  }
  async deployCode(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }
    const { source, name, chainId, constructorArgs, language } = parameters;
    if (!source || typeof source !== 'string') {
      throw new Error('Valid source code string is required for deployment');
    }
    if (language && language !== 'solidity') {
      throw new Error(`Language ${language} not supported`);
    }
    if (this._isStubSource(source)) {
      throw new Error('Cannot deploy stub source code. Only Solidity is supported.');
    }
    if (!this.contractFactory) {
      throw new Error('ContractFactory not available');
    }
    try {
      this.emit('deploymentStarted', { name, chainId: chainId || this.config.defaultChain });
      const contractConfig = {
        name: name || 'GeneratedContract',
        source: source,
        constructorArgs: constructorArgs || []
      };
      const deployment = await this.contractFactory.deployContract(
        contractConfig,
        chainId || this.config.defaultChain
      );
      this.stats.totalDeployments++;
      const result = {
        success: deployment.success,
        contractAddress: deployment.contractAddress,
        txHash: deployment.txHash,
        chainId: deployment.chainId || chainId || this.config.defaultChain,
        abi: deployment.abi,
        timestamp: new Date().toISOString()
      };
      if (deployment.success === false) {
        this.stats.failedDeployments++;
      } else {
        this.stats.successfulDeployments++;
      }
      this.emit('deploymentCompleted', result);
      return result;
    } catch (error) {
      this.stats.totalDeployments++;
      this.stats.failedDeployments++;
      this.emit('deploymentError', { name, error: error.message });
      throw error;
    }
  }
  async generateAndDeploy(parameters) {
    try {
      const generation = await this.generateCode({
        description: parameters.description,
        name: parameters.name,
        language: parameters.language,
        options: parameters.options
      });
      let compilation = null;
      if (this.config.enableCompilation && generation.source) {
        compilation = await this.compileCode({
          source: generation.source,
          name: generation.name,
          language: generation.language
        });
      }
      let deployment = null;
      if (this.config.enableDeployment && parameters.deploy !== false) {
        deployment = await this.deployCode({
          source: generation.source,
          name: generation.name,
          chainId: parameters.chainId,
          constructorArgs: parameters.constructorArgs,
          language: generation.language
        });
      }
      return {
        success: true,
        generation,
        compilation,
        deployment,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }
  generateContractSource(description, name, language, options) {
    if (language === 'solidity') {
      return this.generateSolidityTemplate(description, name, options);
    }
    throw new Error(`Language ${language} not supported`);
  }
  sanitizeContractName(name) {
    if (!name || typeof name !== 'string') {
      name = 'Contract';
    }
    let sanitized = name.replace(/[^a-zA-Z0-9]/g, '');
    sanitized = sanitized.replace(/([a-z])([A-Z])/g, '$1|$2'); 
    sanitized = sanitized.replace(/([0-9])([a-zA-Z])/g, '$1|$2'); 
    sanitized = sanitized.replace(/([a-zA-Z])([0-9])/g, '$1|$2'); 
    const words = sanitized.split('|').filter(word => word.length > 0);
    sanitized = words.map(word => {
      if (word.length > 0 && /[a-z]/.test(word[0])) {
        return word[0].toUpperCase() + word.slice(1);
      } else if (word.length > 0 && /[A-Z]/.test(word[0])) {
        return word; 
      }
      return word; 
    }).join('');
    if (sanitized.length > 0 && /[a-z]/.test(sanitized[0])) {
      sanitized = sanitized[0].toUpperCase() + sanitized.slice(1);
    }
    sanitized = sanitized.replace(/^[0-9]+/, '');
    if (!sanitized || sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
      sanitized = 'Contract' + sanitized;
    }
    const validIdentifierPattern = /^[a-zA-Z][a-zA-Z0-9]*$/;
    if (!validIdentifierPattern.test(sanitized)) {
      sanitized = 'Contract';
    }
    return sanitized;
  }
  generateSolidityTemplate(description, name, options) {
    if (!name || typeof name !== 'string') {
      name = 'Contract';
    }
    const contractName = this.sanitizeContractName(name);
    return `
pragma solidity ^0.8.20;
contract ${contractName} {
    constructor() {
    }
}
`;
  }
  getHistory() {
    return [...this.generationHistory];
  }
  getStats() {
    return {
      ...this.stats,
      historyCount: this.generationHistory.length,
      contractFactoryAvailable: !!this.contractFactory
    };
  }
}
export default CodeGenerator;
