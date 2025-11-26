export interface Timestamp {
  createdAt: string;
  updatedAt?: string;
}

export interface BaseEntity extends Timestamp {
  id: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type Network = 'alfajores' | 'mainnet' | 'baklava';

export interface ChainConfig {
  network: Network;
  rpcUrl: string;
  chainId: number;
  name: string;
}
