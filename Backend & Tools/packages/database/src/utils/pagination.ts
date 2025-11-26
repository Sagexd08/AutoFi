export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function normalizePagination(params: PaginationParams): { skip: number; take: number } {
  if (params.skip !== undefined && params.take !== undefined) {
    return { skip: params.skip, take: params.take };
  }
  
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const { skip, take } = normalizePagination(params);
  const page = Math.floor(skip / take) + 1;
  const totalPages = Math.ceil(total / take);
  
  return {
    data,
    pagination: {
      page,
      limit: take,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
