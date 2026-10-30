import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/logger.js';

export interface AuthUserPayload {
  id: string;
  role: 'admin' | 'doctor' | 'patient';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (_error) {
    next(new AppError('Invalid or expired token', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Access denied', 403));
    }
    next();
  };
};

