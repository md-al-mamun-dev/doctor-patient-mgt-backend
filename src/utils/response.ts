import type { Response } from 'express';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PRECONDITION_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ApiSuccessOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  headers?: Record<string, string>;
}

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorOptions {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: ErrorDetail[];
  requestId?: string;
  data?: unknown; // E.g. latest document state on 412 PRECONDITION_FAILED
  headers?: Record<string, string>;
}

export const sendSuccess = <T>(res: Response, options: ApiSuccessOptions<T>): void => {
  const { statusCode = 200, message, data, meta, headers } = options;

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }

  // 204 No Content has no body
  if (statusCode === 204) {
    res.status(204).end();
    return;
  }

  res.status(statusCode).json({
    success: true,
    ...(message !== undefined && { message }),
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  });
};

export const sendError = (res: Response, options: ApiErrorOptions): void => {
  const {
    statusCode,
    code,
    message,
    details = [],
    requestId = (res.req as any)?.id || 'unknown',
    data,
    headers,
  } = options;

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details.length > 0 && { details }),
      requestId,
    },
    ...(data !== undefined && { data }),
  });
};
