export interface AutomatorConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  langchainApiKey?: string;
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
