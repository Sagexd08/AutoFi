

import dotenv from 'dotenv';


dotenv.config();


export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  enableMasking: boolean;
  maskingStrategy: 'full' | 'partial' | 'hash';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableEncryption: boolean;
  enableAuditLogging: boolean;
  maskFields: string[];
  gdprCompliant: boolean;
}


const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  development: {
    environment: 'development',
    enableMasking: true,
    maskingStrategy: 'partial',
    logLevel: 'debug',
    enableEncryption: false,
    enableAuditLogging: false,
    maskFields: ['privateKey', 'apiKey', 'password', 'secret'],
    gdprCompliant: false,
  },
  staging: {
    environment: 'staging',
    enableMasking: true,
    maskingStrategy: 'partial',
    logLevel: 'info',
    enableEncryption: true,
    enableAuditLogging: true,
    maskFields: ['privateKey', 'apiKey', 'password', 'secret', 'token'],
    gdprCompliant: true,
  },
  production: {
    environment: 'production',
    enableMasking: true,
    maskingStrategy: 'full',
    logLevel: 'warn',
    enableEncryption: true,
    enableAuditLogging: true,
    maskFields: [
      'privateKey',
      'apiKey',
      'password',
      'secret',
      'token',
      'auth',
      'credential',
      'email',
      'phone',
      'address',
    ],
    gdprCompliant: true,
  },
};


export class EnvironmentConfigManager {
  private static instance: EnvironmentConfigManager;
  private config: EnvironmentConfig;

  private constructor() {
    const env = (process.env.NODE_ENV || 'development') as keyof typeof ENVIRONMENT_CONFIGS;
    this.config = this.loadConfig(env);
  }

  
  private loadConfig(env: string): EnvironmentConfig {
    const baseConfig = ENVIRONMENT_CONFIGS[env] || ENVIRONMENT_CONFIGS.development;
    
    
    return {
      ...baseConfig,
      enableMasking: process.env.ENABLE_MASKING !== undefined 
        ? process.env.ENABLE_MASKING === 'true' 
        : baseConfig.enableMasking,
      enableEncryption: process.env.ENABLE_ENCRYPTION !== undefined
        ? process.env.ENABLE_ENCRYPTION === 'true'
        : baseConfig.enableEncryption,
      enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== undefined
        ? process.env.ENABLE_AUDIT_LOGGING === 'true'
        : baseConfig?.enableAuditLogging,
      gdprCompliant: process.env.GDPR_COMPLIANT !== undefined
        ? process.env.GDPR_COMPLIANT === 'true'
        : baseConfig.gdprCompliant,
      logLevel: (['debug', 'info', 'warn', 'error'].includes(process.env.LOG_LEVEL as string))
        ? (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error')
        : baseConfig.logLevel,
      maskFields: process.env.MASK_FIELDS 
        ? process.env.MASK_FIELDS.split(',')
        : baseConfig.maskFields,
    };
  }

  
  static getInstance(): EnvironmentConfigManager {
    if (!EnvironmentConfigManager.instance) {
      EnvironmentConfigManager.instance = new EnvironmentConfigManager();
    }
    return EnvironmentConfigManager.instance;
  }

  
  getConfig(): Readonly<EnvironmentConfig> {
    return { ...this.config };
  }

  
  updateConfig(updates: Partial<EnvironmentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  
  reload(): void {
    const env = (process.env.NODE_ENV || 'development') as keyof typeof ENVIRONMENT_CONFIGS;
    this.config = this.loadConfig(env);
  }

  
  getMaskingConfig() {
    return {
      strategy: this.config.maskingStrategy,
      maskFields: this.config.maskFields,
      environmentRules: {
        [this.config.environment]: {
          strategy: this.config.maskingStrategy,
          maskFields: this.config.maskFields,
        },
      },
    };
  }

  
  getLoggerConfig() {
    return {
      logLevel: this.config.logLevel,
      enableMasking: this.config.enableMasking,
      maskingConfig: this.getMaskingConfig(),
    };
  }
}


export const envConfig = EnvironmentConfigManager.getInstance();


export function getEnvironmentConfig(): Readonly<EnvironmentConfig> {
  return envConfig.getConfig();
}

