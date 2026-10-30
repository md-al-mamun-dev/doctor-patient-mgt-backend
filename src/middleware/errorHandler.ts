import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: unknown[] = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || [];
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values((err as any).errors || {}).map((e: any) => e.message);
  } else if (err.name === 'CastError') {
    // Mongoose bad ObjectId
    statusCode = 400;
    message = `Invalid ${(err as any).path}: ${(err as any).value}`;
  } else if ((err as any).code === 11000) {
    // Mongoose duplicate key
    statusCode = 409;
    const field = Object.keys((err as any).keyValue || {})[0];
    message = `Duplicate value entered for ${field}`;
  } else if (err.message) {
    message = err.message;
  }

  if (config.NODE_ENV === 'development') {
    console.error('⚠️ [ErrorHandler]:', err);
  }

  sendError(res, statusCode, message, errors);
};

