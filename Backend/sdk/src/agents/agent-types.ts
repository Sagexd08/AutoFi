export const AGENT_TYPES = {
  TREASURY: 'treasury',
  DEFI: 'defi',
  NFT: 'nft',
  GOVERNANCE: 'governance',
  SECURITY: 'security',
  ANALYTICS: 'analytics',
} as const;
export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];
