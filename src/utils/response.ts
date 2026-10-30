import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponseOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
}

export const sendSuccess = <T>(
  res: Response,
  options: ApiResponseOptions<T>
): void => {
  const { statusCode = 200, message = 'Success', data, meta } = options;
  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  });
};

export const sendError = (
  res: Response,
  statusCode = 500,
  message = 'An error occurred',
  errors: unknown[] = []
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

