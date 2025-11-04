import { EventEmitter } from 'events';

/**
 * Code Generator - Wrapper service for ContractFactory
 * 
 * Provides code generation capabilities for smart contracts
 * Acts as a bridge between AI system and ContractFactory
 */
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

  /**
   * Set ContractFactory instance
   * @param {Object} contractFactory - ContractFactory instance
   */
  setContractFactory(contractFactory) {
    this.contractFactory = contractFactory;
    this.emit('contractFactorySet', { available: !!contractFactory });
  }

  /**
   * Generate code from description
   * @param {Object} parameters - Generation parameters
   * @param {string} parameters.description - Description of contract to generate
   * @param {string} parameters.name - Contract name
   * @param {string} parameters.language - Language (default: 'solidity')
   * @param {Object} parameters.options - Additional options
   * @returns {Promise<Object>} Generated code
   */
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
        abi: null, // ABI will be available after compilation via compileCode()
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

  /**
   * Compile contract code
   * @param {Object} parameters - Compilation parameters
   * @param {string} parameters.source - Contract source code
   * @param {string} parameters.name - Contract name
   * @returns {Promise<Object>} Compilation result
   */
  async compileCode(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }

    const { source, name } = parameters;
    
    if (!source || typeof source !== 'string') {
      throw new Error('Valid source code string is required');
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

  /**
   * Deploy generated code
   * @param {Object} parameters - Deployment parameters
   * @param {string} parameters.source - Contract source code
   * @param {string} parameters.name - Contract name
   * @param {string} parameters.chainId - Chain ID (optional)
   * @param {Array} parameters.constructorArgs - Constructor arguments (optional)
   * @returns {Promise<Object>} Deployment result
   */
  async deployCode(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      throw new Error('Invalid parameters provided');
    }

    const { source, name, chainId, constructorArgs } = parameters;
    
    if (!source || typeof source !== 'string') {
      throw new Error('Valid source code string is required for deployment');
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
      
      const result = {
        success: deployment.success,
        contractAddress: deployment.contractAddress,
        txHash: deployment.txHash,
        chainId: deployment.chainId || chainId || this.config.defaultChain,
        abi: deployment.abi,
        timestamp: new Date().toISOString()
      };
      
      if (deployment.success) {
        this.stats.successfulDeployments++;
        this.stats.totalDeployments++;
      }
      
      this.emit('deploymentCompleted', result);
      
      return result;
      
    } catch (error) {
      this.stats.failedDeployments++;
      this.stats.totalDeployments++;
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
          name: generation.name
        });
      }
      
      let deployment = null;
      if (this.config.enableDeployment && parameters.deploy !== false) {
        deployment = await this.deployCode({
          source: generation.source,
          name: generation.name,
          chainId: parameters.chainId,
          constructorArgs: parameters.constructorArgs
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
    
    return `// Generated ${language} contract: ${name}\n// Description: ${description}\n`;
  }

  /**
   * Sanitize contract name to ensure it's a valid Solidity identifier
   * @param {string} name - Raw contract name
   * @returns {string} Sanitized contract name
   * @throws {Error} If sanitization yields an invalid identifier
   */
  sanitizeContractName(name) {
    if (!name || typeof name !== 'string') {
      name = 'Contract';
    }
    
    // Step 1: Remove all non-alphanumeric characters (keep only ASCII letters and digits)
    let sanitized = name.replace(/[^a-zA-Z0-9]/g, '');
    
    // Step 2: Convert to PascalCase
    // Split by word boundaries (detect camelCase transitions and digit boundaries)
    // Insert temporary markers at word boundaries
    sanitized = sanitized.replace(/([a-z])([A-Z])/g, '$1|$2'); // Insert marker before uppercase after lowercase
    sanitized = sanitized.replace(/([0-9])([a-zA-Z])/g, '$1|$2'); // Insert marker before letter after digit
    sanitized = sanitized.replace(/([a-zA-Z])([0-9])/g, '$1|$2'); // Insert marker before digit after letter
    
    // Split by markers and capitalize first letter of each word
    const words = sanitized.split('|').filter(word => word.length > 0);
    sanitized = words.map(word => {
      // Capitalize first letter if it's a letter
      if (word.length > 0 && /[a-z]/.test(word[0])) {
        return word[0].toUpperCase() + word.slice(1);
      } else if (word.length > 0 && /[A-Z]/.test(word[0])) {
        return word; // Already capitalized
      }
      return word; // Keep digits as-is
    }).join('');
    
    // Ensure first character is uppercase if it's a letter
    if (sanitized.length > 0 && /[a-z]/.test(sanitized[0])) {
      sanitized = sanitized[0].toUpperCase() + sanitized.slice(1);
    }
    
    // Step 3: Remove leading digits
    sanitized = sanitized.replace(/^[0-9]+/, '');
    
    // Step 4: Validate and apply fallback if needed
    // Check if name is empty or starts with a digit after sanitization
    if (!sanitized || sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
      sanitized = 'Contract' + sanitized;
    }
    
    // Final validation: ensure it contains only ASCII letters and digits, starts with a letter
    const validIdentifierPattern = /^[a-zA-Z][a-zA-Z0-9]*$/;
    if (!validIdentifierPattern.test(sanitized)) {
      // Last resort: use deterministic fallback
      sanitized = 'Contract';
    }
    
    return sanitized;
  }

  generateSolidityTemplate(description, name, options) {
    if (!name || typeof name !== 'string') {
      name = 'Contract';
    }
    const contractName = this.sanitizeContractName(name);
    
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ${contractName}
 * @notice ${description}
 */
contract ${contractName} {
    // Contract implementation
    // Generated based on: ${description}
    
    constructor() {
        // Constructor implementation
    }
    
    // Add your functions here
}
`;
  }

  /**
   * Get generation history
   * @returns {Array} Generation history
   */
  getHistory() {
    return [...this.generationHistory];
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      historyCount: this.generationHistory.length,
      contractFactoryAvailable: !!this.contractFactory
    };
  }
}

export default CodeGenerator;
