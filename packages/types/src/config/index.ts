export interface AutomatorConfig {
  // Custom ML configuration (no external LLM dependencies)
  mlEngineEnabled?: boolean;
  celoPrivateKey?: string;
  network: 'alfajores' | 'mainnet' | 'baklava';
  rpcUrl?: string;
  databaseUrl?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableTracing?: boolean;
}

export interface CLIConfig {
  apiUrl?: string;
  apiKey?: string;
  defaultNetwork?: string;
  outputFormat?: 'json' | 'table' | 'yaml';
  colorOutput?: boolean;
}
