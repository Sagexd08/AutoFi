
export interface PaginationParams {

  page?: number;

  limit?: number;

  cursor?: string;

  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export class PaginationHelper {

  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  static calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  static buildQuery(params: PaginationParams): Record<string, string> {
    const query: Record<string, string> = {};

    if (params.page !== undefined) {
      query.page = String(params.page);
    }
    if (params.limit !== undefined) {
      query.limit = String(params.limit);
    }
    if (params.cursor) {
      query.cursor = params.cursor;
    }
    if (params.offset !== undefined) {
      query.offset = String(params.offset);
    }

    return query;
  }

  static hasMore(items: unknown[], limit: number): boolean {
    return items.length === limit;
  }
}

export async function* paginate<T>(
  fetcher: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  options: {
    initialPage?: number;
    limit?: number;
    maxPages?: number;
  } = {}
): AsyncGenerator<T[], void, unknown> {
  const { initialPage = 1, limit = 10, maxPages } = options;
  let page = initialPage;
  let hasMore = true;
  let pagesFetched = 0;

  while (hasMore && (maxPages === undefined || pagesFetched < maxPages)) {
    const response = await fetcher({ page, limit });
    yield response.items;

    hasMore = response.pagination.hasMore ?? false;
    page++;
    pagesFetched++;

    if (response.pagination.totalPages && page > response.pagination.totalPages) {
      hasMore = false;
    }
  }
}

