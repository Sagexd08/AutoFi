import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import { getRequestId } from '../utils/request-id.js';

const TOOL_SCHEMAS = {
  'sdk_initialize': {
    parameters: {},
    required: []
  },
  'sdk_execute_transaction': {
    parameters: {
      to: { type: 'string', format: 'address', required: true, maxLength: 42 },
      value: { type: 'string', format: 'wei', required: false, maxLength: 77 },
      data: { type: 'string', format: 'hex', required: false, maxLength: 10000 },
      gasLimit: { type: 'string', format: 'number', required: false, maxLength: 20 },
      chainId: { type: 'string', format: 'chainId', required: false, maxLength: 10 }
    },
    required: ['to']
  },
  'sdk_get_token_balance': {
    parameters: {
      address: { type: 'string', format: 'address', required: true, maxLength: 42 },
      tokenAddress: { type: 'string', format: 'address', required: true, maxLength: 42 }
    },
    required: ['address', 'tokenAddress']
  },
  'sdk_send_token': {
    parameters: {
      to: { type: 'string', format: 'address', required: true, maxLength: 42 },
      amount: { type: 'string', format: 'wei', required: true, maxLength: 77 },
      tokenAddress: { type: 'string', format: 'address', required: true, maxLength: 42 }
    },
    required: ['to', 'amount', 'tokenAddress']
  },
  'sdk_deploy_contract': {
    parameters: {
      abi: { type: 'array', required: true, maxLength: 10000 },
      bytecode: { type: 'string', format: 'hex', required: true, maxLength: 100000 },
      constructorArgs: { type: 'array', required: false, maxLength: 100 },
      chainId: { type: 'string', format: 'chainId', required: false, maxLength: 10 }
    },
    required: ['abi', 'bytecode']
  },
  'sdk_create_agent': {
    parameters: {
      agentType: { type: 'string', format: 'alphanumeric', required: true, maxLength: 50 },
      config: { type: 'object', required: true, maxDepth: 5 }
    },
    required: ['agentType', 'config']
  },
  'sdk_get_chain_health': {
    parameters: {},
    required: []
  },
  'sdk_get_supported_chains': {
    parameters: {},
    required: []
  }
};

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  return value
    .replace(/[<>]/g, '')
    .replace(/[`$(){}[\]]/g, '')
    .replace(/[;&|`$]/g, '')
    .trim();
}

function sanitizeObject(obj, depth = 0) {
  if (depth > 10) {
    throw new Error('Maximum object depth exceeded');
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const safeKey = sanitizeString(key);
      sanitized[safeKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
}

function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidHex(hex) {
  return typeof hex === 'string' && /^0x[a-fA-F0-9]*$/.test(hex);
}

function isValidWei(amount) {
  return typeof amount === 'string' && /^\d+$/.test(amount);
}

function isValidChainId(chainId) {
  const id = parseInt(chainId, 10);
  return !isNaN(id) && id > 0 && id < 2147483647;
}

function isAlphanumeric(str) {
  return typeof str === 'string' && /^[a-zA-Z0-9_-]+$/.test(str);
}

function validateParameter(value, schema) {
  if (schema.type === 'string' && typeof value !== 'string') {
    return { valid: false, error: `Expected string, got ${typeof value}` };
  }
  
  if (schema.type === 'number' && typeof value !== 'number') {
    return { valid: false, error: `Expected number, got ${typeof value}` };
  }
  
  if (schema.type === 'array' && !Array.isArray(value)) {
    return { valid: false, error: `Expected array, got ${typeof value}` };
  }
  
  if (schema.type === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
    return { valid: false, error: `Expected object, got ${typeof value}` };
  }
  
  if (schema.type === 'string' && schema.maxLength && value.length > schema.maxLength) {
    return { valid: false, error: `String length exceeds maximum of ${schema.maxLength} characters` };
  }
  
  if (schema.type === 'string' && schema.format) {
    switch (schema.format) {
      case 'address':
        if (!isValidAddress(value)) {
          return { valid: false, error: 'Invalid address format. Must be 0x followed by 40 hex characters' };
        }
        break;
      case 'hex':
        if (!isValidHex(value)) {
          return { valid: false, error: 'Invalid hexadecimal format' };
        }
        break;
      case 'wei':
        if (!isValidWei(value)) {
          return { valid: false, error: 'Invalid Wei amount format. Must be a numeric string' };
        }
        break;
      case 'chainId':
        if (!isValidChainId(value)) {
          return { valid: false, error: 'Invalid chain ID format' };
        }
        break;
      case 'alphanumeric':
        if (!isAlphanumeric(value)) {
          return { valid: false, error: 'Invalid format. Must contain only alphanumeric characters, underscores, or hyphens' };
        }
        break;
    }
  }
  
  if (schema.type === 'array' && schema.maxLength && value.length > schema.maxLength) {
    return { valid: false, error: `Array length exceeds maximum of ${schema.maxLength} items` };
  }
  
  if (schema.type === 'object' && schema.maxDepth) {
    const depth = getObjectDepth(value);
    if (depth > schema.maxDepth) {
      return { valid: false, error: `Object depth exceeds maximum of ${schema.maxDepth} levels` };
    }
  }
  
  return { valid: true };
}

function getObjectDepth(obj, current = 0) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return current;
  }
  
  let maxDepth = current;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const depth = getObjectDepth(value, current + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  return maxDepth;
}

export function validateToolExecution(automationSystem) {
  return [
    param('toolId')
      .trim()
      .notEmpty()
      .withMessage('toolId is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('toolId must be between 1 and 100 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('toolId contains invalid characters'),
    
    body('parameters')
      .optional()
      .custom((value) => {
        if (value !== undefined && typeof value !== 'object') {
          throw new Error('parameters must be an object');
        }
        return true;
      }),
    
    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const errorMessages = errors.array().map(err => ({
            field: err.path || err.param,
            message: err.msg
          }));
          
          logger.error('Validation failed', {
            toolId: req.params.toolId,
            errors: errorMessages,
            ip: req.ip,
            requestId: getRequestId(req),
            timestamp: new Date().toISOString()
          });
          
          return res.status(400).json({
            error: 'Validation failed',
            details: errorMessages
          });
        }
        
        const { toolId } = req.params;
        const { parameters = {} } = req.body;
        
        if (!automationSystem?.environmentManager) {
          return res.status(503).json({ error: 'Environment Manager not available' });
        }
        
        const tool = automationSystem.environmentManager.getTool(toolId);
        if (!tool) {
          logger.error('Tool not found', {
            toolId,
            ip: req.ip,
            requestId: getRequestId(req),
            timestamp: new Date().toISOString()
          });
          
          return res.status(404).json({ error: `Tool ${toolId} not found` });
        }
        
        const schema = TOOL_SCHEMAS[toolId];
        
        if (schema) {
          for (const requiredParam of schema.required) {
            if (!(requiredParam in parameters)) {
              const errorMsg = `Missing required parameter: ${requiredParam}`;
              logger.error('Validation failed', {
                toolId,
                error: errorMsg,
                ip: req.ip,
                requestId: getRequestId(req),
                timestamp: new Date().toISOString()
              });
              
              return res.status(400).json({
                error: 'Validation failed',
                details: [{ field: requiredParam, message: errorMsg }]
              });
            }
          }
          
          const allowedParams = Object.keys(schema.parameters);
          const providedParams = Object.keys(parameters);
          
          const unknownParams = providedParams.filter(param => !allowedParams.includes(param));
          if (unknownParams.length > 0) {
            const errorMsg = `Unknown parameters: ${unknownParams.join(', ')}. Allowed: ${allowedParams.join(', ') || 'none'}`;
            logger.error('Validation failed', {
              toolId,
              error: errorMsg,
              unknownParams,
              ip: req.ip,
              requestId: getRequestId(req),
              timestamp: new Date().toISOString()
            });
            
            return res.status(400).json({
              error: 'Validation failed',
              details: [{ field: 'parameters', message: errorMsg }]
            });
          }
          
          const validationErrors = [];
          const sanitizedParameters = {};
          
          for (const [paramName, paramValue] of Object.entries(parameters)) {
            const paramSchema = schema.parameters[paramName];
            
            if (!paramSchema) {
              continue;
            }
            
            const validation = validateParameter(paramValue, paramSchema);
            if (!validation.valid) {
              validationErrors.push({
                field: paramName,
                message: validation.error
              });
            } else {
              sanitizedParameters[paramName] = sanitizeObject(paramValue);
            }
          }
          
          if (validationErrors.length > 0) {
            logger.error('Validation failed', {
              toolId,
              errors: validationErrors,
              ip: req.ip,
              requestId: getRequestId(req),
              timestamp: new Date().toISOString()
            });
            
            return res.status(400).json({
              error: 'Validation failed',
              details: validationErrors
            });
          }
          
          req.body.parameters = sanitizedParameters;
        } else {
          logger.warn('No schema defined for tool, applying generic validation', {
            toolId,
            ip: req.ip,
            requestId: getRequestId(req),
            timestamp: new Date().toISOString()
          });
          
          req.body.parameters = sanitizeObject(parameters);
          
          const paramString = JSON.stringify(parameters);
          if (paramString.length > 100000) {
            logger.error('Validation failed: Parameters too large', {
              toolId,
              size: paramString.length,
              ip: req.ip,
              requestId: getRequestId(req),
              timestamp: new Date().toISOString()
            });
            
            return res.status(400).json({
              error: 'Validation failed',
              details: [{ field: 'parameters', message: 'Parameters object too large (max 100KB)' }]
            });
          }
        }
        
        next();
        
      } catch (error) {
        logger.error('Validation middleware error', {
          error: error.message,
          stack: error.stack,
          toolId: req.params.toolId,
          ip: req.ip,
          requestId: getRequestId(req),
          timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
          error: 'Validation error',
          details: [{ message: 'Internal validation error occurred' }]
        });
      }
    }
  ];
}
