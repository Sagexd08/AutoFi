import { AlchemyClient, NFTOperation, NFTMintResult } from '../alchemy-client';
import { SecureTransactionManager } from '../secure-transaction-manager';
import { CeloClient } from '../celo-client';
import { Address, Hash } from 'viem';

export interface NFTMintParams {
  contractAddress: Address;
  recipient: Address;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  tokenId?: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  tokenId: string;
  contractAddress: Address;
}

export interface NFTOwned {
  contractAddress: Address;
  tokenId: string;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  tokenType: string;
}

export interface NFTTransfer {
  from: Address;
  to: Address;
  contractAddress: Address;
  tokenId: string;
  value: string;
  blockNumber: string;
  transactionHash: Hash;
  category: string;
}

export interface NFTMintConfig {
  alchemyApiKey: string;
  alchemyPolicyId?: string;
  network: 'alfajores' | 'mainnet';
  maxRiskScore?: number;
  requireApproval?: boolean;
}

export async function mintNFT(
  celoClient: CeloClient,
  config: NFTMintConfig,
  params: NFTMintParams
): Promise<{
  success: boolean;
  transactionHash?: Hash;
  tokenId?: string;
  gasUsed?: bigint;
  error?: string;
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const secureManager = new SecureTransactionManager(
    alchemyClient,
    celoClient,
    {
      maxRiskScore: config.maxRiskScore || 50,
      requireApproval: config.requireApproval !== false,
      enableSimulation: true,
      enableGasOptimization: true
    }
  );

  const nftOperation: NFTOperation = {
    contractAddress: params.contractAddress,
    to: params.recipient,
    operation: 'mint',
    tokenId: params.tokenId,
    metadata: params.metadata
  };

  const result = await secureManager.mintSecureNFT(nftOperation);

  return {
    success: result.success,
    transactionHash: result.result?.transactionHash,
    tokenId: result.result?.tokenId,
    gasUsed: result.result?.gasUsed,
    error: result.error
  };
}

export async function getNFTMetadata(
  config: NFTMintConfig,
  contractAddress: Address,
  tokenId: string
): Promise<NFTMetadata> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const metadata = await alchemyClient.getNFTMetadata(contractAddress, tokenId);

  return {
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    attributes: metadata.attributes,
    tokenId: metadata.tokenId,
    contractAddress: metadata.contractAddress as Address
  };
}

export async function getOwnedNFTs(
  config: NFTMintConfig,
  address: Address,
  contractAddress?: Address
): Promise<NFTOwned[]> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const nfts = await alchemyClient.getOwnedNFTs(address, contractAddress);

  return nfts.map(nft => ({
    contractAddress: nft.contractAddress as Address,
    tokenId: nft.tokenId,
    name: nft.name,
    description: nft.description,
    image: nft.image,
    attributes: nft.attributes,
    tokenType: nft.tokenType
  }));
}

export async function getNFTTransfers(
  config: NFTMintConfig,
  address: Address,
  category: 'in' | 'out' | 'both' = 'both'
): Promise<NFTTransfer[]> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const transfers = await alchemyClient.getNFTTransfers(address, category);

  return transfers.map(transfer => ({
    from: transfer.from as Address,
    to: transfer.to as Address,
    contractAddress: transfer.contractAddress as Address,
    tokenId: transfer.tokenId || '',
    value: transfer.value?.toString() || '0',
    blockNumber: transfer.blockNumber,
    transactionHash: transfer.transactionHash as Hash,
    category: transfer.category
  }));
}

export async function getNFTCollection(
  config: NFTMintConfig,
  contractAddress: Address
): Promise<{
  name: string;
  symbol: string;
  totalSupply: string;
  contractAddress: Address;
  tokenType: string;
}> {
  const alchemyClient = new AlchemyClient({
    apiKey: config.alchemyApiKey,
    policyId: config.alchemyPolicyId,
    network: config.network
  });

  const collection = await alchemyClient.getNFTCollection(contractAddress);

  return {
    name: collection.name || '',
    symbol: collection.symbol || '',
    totalSupply: collection.totalSupply || '0',
    contractAddress: collection.contractAddress as Address,
    tokenType: collection.tokenType
  };
}

export async function batchMintNFTs(
  celoClient: CeloClient,
  config: NFTMintConfig,
  params: NFTMintParams[]
): Promise<{
  results: Array<{
    success: boolean;
    transactionHash?: Hash;
    tokenId?: string;
    error?: string;
  }>;
  overallSuccess: boolean;
}> {
  const results = [];
  let overallSuccess = true;

  for (const param of params) {
    const result = await mintNFT(celoClient, config, param);

    results.push({
      success: result.success,
      transactionHash: result.transactionHash,
      tokenId: result.tokenId,
      error: result.error
    });

    if (!result.success) {
      overallSuccess = false;
    }
  }

  return { results, overallSuccess };
}

export function createEventNFTMetadata(
  eventName: string,
  eventDate: string,
  attendeeName: string,
  imageUrl: string
): {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
} {
  return {
    name: `${eventName} - ${attendeeName}`,
    description: `Attendance certificate for ${eventName} on ${eventDate}`,
    image: imageUrl,
    attributes: [
      { trait_type: 'Event', value: eventName },
      { trait_type: 'Date', value: eventDate },
      { trait_type: 'Attendee', value: attendeeName },
      { trait_type: 'Type', value: 'Attendance Certificate' }
    ]
  };
}
