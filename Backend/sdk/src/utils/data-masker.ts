

export interface MaskingConfig {
  
  maskFields?: string[];
  
  customMaskers?: Record<string, (value: unknown) => string>;
  
  strategy?: 'full' | 'partial' | 'hash';
  
  visibleChars?: number;
  
  maskChar?: string;
  
  environmentRules?: Record<string, MaskingConfig>;
}


const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'privateKey',
  'secret',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'authorization',
  'token',
  'auth',
  'credential',
  'creditCard',
  'ssn',
  'socialSecurityNumber',
  'email',
  'phone',
  'address',
  'private_key',
  'privateKeyHex',
  'mnemonic',
  'seedPhrase',
];


export class DataMasker {
  private config: Required<MaskingConfig>;
  private maskFieldsSet: Set<string>;
  private customMaskersMap: Map<string, (value: unknown) => string>;

  constructor(config: MaskingConfig = {}) {
    const environment = process.env.NODE_ENV || 'development';
    const envConfig = config.environmentRules?.[environment] || {};
    
    const maskFields = config.maskFields || DEFAULT_SENSITIVE_FIELDS;
    this.config = {
      maskFields,
      customMaskers: config.customMaskers || {},
      strategy: config.strategy || envConfig.strategy || 'partial',
      visibleChars: config.visibleChars ?? envConfig.visibleChars ?? 4,
      maskChar: config.maskChar || envConfig.maskChar || '*',
      environmentRules: config.environmentRules || {},
    };
    
    // Pre-build Set of lowercased maskFields for O(1) lookup
    this.maskFieldsSet = new Set(maskFields.map(field => field.toLowerCase()));
    
    // Normalize customMaskers keys to lowercase for consistent lookup
    this.customMaskersMap = new Map();
    if (config.customMaskers) {
      Object.entries(config.customMaskers).forEach(([key, masker]) => {
        this.customMaskersMap.set(key.toLowerCase(), masker);
      });
    }
  }

  
  maskValue(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    const strValue = String(value);
    
    if (strValue.length === 0) {
      return '';
    }

    switch (this.config.strategy) {
      case 'full':
        return this.config.maskChar.repeat(strValue.length);
      
      case 'hash':
        return this.hashValue(strValue);
      
      case 'partial':
      default:
        return this.partialMask(strValue);
    }
  }

  
  private partialMask(value: string): string {
    // Compute visible chars ensuring at least 1 on each side and room for mask in middle
    let visible = Math.max(1, Math.min(this.config.visibleChars, Math.floor((value.length - 1) / 2)));
    
    // Calculate masked length
    let maskedLength = value.length - visible * 2;
    
    // If no room for mask char, fall back to minimal partial reveal
    if (maskedLength <= 0) {
      visible = Math.max(1, Math.floor(value.length / 2)) - 1;
      maskedLength = value.length - visible * 2;
    }
    
    const start = value.substring(0, visible);
    const end = value.substring(value.length - visible);
    const masked = this.config.maskChar.repeat(maskedLength);

    return `${start}${masked}${end}`;
  }

  
  private hashValue(value: string): string {
    
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash | 0; 
    }
    return `hash_${Math.abs(hash).toString(16).substring(0, 8)}`;
  }

  
  maskObject<T extends Record<string, unknown>>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item)) as unknown as T;
    }

    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      
      const shouldMask = this.maskFieldsSet.has(lowerKey);

      if (shouldMask) {
        
        const customMasker = this.customMaskersMap.get(lowerKey);
        if (customMasker) {
          masked[key] = customMasker(value);
        } else {
          masked[key] = this.maskValue(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        
        masked[key] = this.maskObject(value as Record<string, unknown>);
      } else {
        masked[key] = value;
      }
    }

    return masked as T;
  }

  
  maskUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      
      const maskedParams = new URLSearchParams();
      urlObj.searchParams.forEach((value, key) => {
        if (this.shouldMaskField(key)) {
          maskedParams.append(key, this.maskValue(value));
        } else {
          maskedParams.append(key, value);
        }
      });

      
      if (urlObj.password) {
        urlObj.password = this.maskValue(urlObj.password);
      }

      urlObj.search = maskedParams.toString();
      return urlObj.toString();
    } catch {
      
      return this.maskValue(url);
    }
  }

  
  sanitizeError(error: Error | unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(String(error));
    }

    const sanitized = new Error(this.sanitizeString(error.message));
    sanitized.name = error.name;
    sanitized.stack = error.stack ? this.sanitizeStackTrace(error.stack) : undefined;

    
    Object.keys(error).forEach(key => {
      if (key !== 'message' && key !== 'name' && key !== 'stack') {
        const value = (error as Record<string, unknown>)[key];
        (sanitized as Record<string, unknown>)[key] = typeof value === 'string' 
          ? this.sanitizeString(value) 
          : value;
      }
    });

    return sanitized;
  }

  
  sanitizeString(str: string): string {
    
    str = str.replace(/0x[a-fA-F0-9]{64}/g, (match) => this.maskValue(match));
    
    
    str = str.replace(/(api[_-]?key|apikey)[=:]\s*([^\s&"']+)/gi, (match, key, value) => 
      `${key}=${this.maskValue(value)}`
    );
    
    
    str = str.replace(/(token|auth|bearer)[=:]\s*([^\s&"']+)/gi, (match, key, value) => 
      `${key}=${this.maskValue(value)}`
    );
    
    
    str = str.replace(/[\w.-]+@[\w.-]+\.\w+/g, (match) => this.maskValue(match));
    
    
    str = str.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, (match) => this.maskValue(match));

    return str;
  }

  
  private sanitizeStackTrace(stack: string): string {
    return stack.split('\n').map(line => {
      
      line = line.replace(/\/[^\s]+/g, (match) => {
        if (match.includes('node_modules')) {
          return match;
        }
        // Keep filename and relative structure, mask only base path
        const parts = match.split('/');
        if (parts.length > 3) {
          return `/<masked>/${parts.slice(-3).join('/')}`;
        }
        return match;
      });
      
      return this.sanitizeString(line);
    }).join('\n');
  }
  
  private shouldMaskField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.maskFieldsSet.has(lowerField);
  }

  
  updateConfig(config: Partial<MaskingConfig>): void {
    const maskFields = config.maskFields || this.config.maskFields;
    const customMaskers = config.customMaskers 
      ? { ...this.config.customMaskers, ...config.customMaskers }
      : this.config.customMaskers;
    
    this.config = {
      ...this.config,
      ...config,
      maskFields,
      customMaskers,
      environmentRules: config.environmentRules 
        ? { ...this.config.environmentRules, ...config.environmentRules }
        : this.config.environmentRules,
    };
    
    // Rebuild Set of lowercased maskFields for O(1) lookup
    this.maskFieldsSet = new Set(maskFields.map(field => field.toLowerCase()));
    
    // Rebuild Map of normalized customMaskers keys
    this.customMaskersMap = new Map();
    if (customMaskers) {
      Object.entries(customMaskers).forEach(([key, masker]) => {
        this.customMaskersMap.set(key.toLowerCase(), masker);
      });
    }
  }

  
  getConfig(): Readonly<MaskingConfig> {
    return { ...this.config };
  }
}


export const defaultDataMasker = new DataMasker();


export const masker = {
  
  value: (value: unknown): string => defaultDataMasker.maskValue(value),

  
  object: <T extends Record<string, unknown>>(obj: T): T => 
    defaultDataMasker.maskObject(obj),

  
  url: (url: string): string => defaultDataMasker.maskUrl(url),

  
  error: (error: Error | unknown): Error => 
    defaultDataMasker.sanitizeError(error),

  
  string: (str: string): string => defaultDataMasker.sanitizeString(str),
};

