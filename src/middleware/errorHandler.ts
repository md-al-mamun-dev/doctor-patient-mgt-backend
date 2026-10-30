import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError, type ErrorDetail } from '../utils/response.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.id || 'unknown';

  // 1. Handled Application Errors
  if (err instanceof AppError) {
    sendError(res, {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      data: err.data,
      requestId,
    });
    return;
  }

  // 2. Zod Request Validation Errors
  if (err instanceof ZodError) {
    const details: ErrorDetail[] = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendError(res, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some fields need fixing.',
      details,
      requestId,
    });
    return;
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Invalid format for field "${err.path}"`,
      details: [{ path: err.path, message: 'Invalid ID representation' }],
      requestId,
    });
    return;
  }

  // 4. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    sendError(res, {
      statusCode: 409,
      code: 'CONFLICT',
      message: `A record with this ${field} already exists.`,
      details: [{ path: field, message: `${field} must be unique` }],
      requestId,
    });
    return;
  }

  // 5. JWT Authentication Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication session is invalid or expired.',
      requestId,
    });
    return;
  }

  // 6. Generic / Uncaught Errors
  console.error(`[INTERNAL_ERROR][${requestId}]`, err);
  sendError(res, {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred.',
    requestId,
  });
};
