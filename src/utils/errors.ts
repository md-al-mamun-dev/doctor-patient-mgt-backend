import type { ApiErrorCode, ErrorDetail } from './response.js';

export class AppError extends Error {
  public statusCode: number;
  public code: ApiErrorCode;
  public details?: ErrorDetail[];
  public data?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code?: ApiErrorCode,
    details?: ErrorDetail[],
    data?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCodeForStatus(statusCode);
    this.details = details;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultCodeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 412:
        return 'PRECONDITION_FAILED';
      case 415:
        return 'UNSUPPORTED_MEDIA_TYPE';
      case 428:
        return 'PRECONDITION_REQUIRED';
      case 429:
        return 'RATE_LIMITED';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}

