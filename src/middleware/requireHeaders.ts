import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

export const requireOrigin = (req: Request, _res: Response, next: NextFunction): void => {
  // Only check state-changing methods
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    // When Origin header is provided (all browser writes), it must match CORS_ORIGIN
    if (origin && origin !== config.CORS_ORIGIN) {
      throw new AppError('Cross-origin request not allowed for state-changing operations', 403, 'FORBIDDEN');
    }
  }
  next();
};

export const requireJson = (req: Request, _res: Response, next: NextFunction): void => {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    const contentLength = req.headers['content-length'];
    const hasBody = contentLength && parseInt(contentLength, 10) > 0;
    const contentType = req.headers['content-type'];

    // If a request has a payload or is a PATCH, it must be application/json
    if (hasBody || req.method === 'PATCH') {
      if (!contentType || !contentType.toLowerCase().includes('application/json')) {
        throw new AppError('Content-Type must be application/json', 415, 'UNSUPPORTED_MEDIA_TYPE');
      }
    }
  }
  next();
};

export const requireIfMatch = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.method === 'PATCH') {
    const ifMatch = req.headers['if-match'];
    if (!ifMatch || typeof ifMatch !== 'string') {
      throw new AppError('If-Match header is required for updates', 428, 'PRECONDITION_REQUIRED');
    }
    // Clean quotes e.g. "4" -> 4
    const rawVersion = ifMatch.replace(/^"|"$/g, '').trim();
    const parsedVersion = parseInt(rawVersion, 10);
    if (Number.isNaN(parsedVersion) || parsedVersion < 1) {
      throw new AppError('If-Match header must be a positive integer version', 400, 'VALIDATION_ERROR', [
        { path: 'If-Match', message: 'Enter a valid version integer' },
      ]);
    }
    (req as any).expectedVersion = parsedVersion;
  }
  next();
};
