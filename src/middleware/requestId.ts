import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingId = req.headers['x-request-id'];
  const id = typeof incomingId === 'string' && incomingId.trim() ? incomingId.trim() : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

