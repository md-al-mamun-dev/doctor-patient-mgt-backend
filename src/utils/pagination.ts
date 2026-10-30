export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  skip: number;
  limit: number;
  page: number;
}

export const getPagination = (options: PaginationOptions): PaginationResult => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
  const skip = (page - 1) * limit;

  return { skip, limit, page };
};

