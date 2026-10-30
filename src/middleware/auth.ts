import type { Request, Response, NextFunction } from 'express';
import { User, type UserRole } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { extractAccessToken, verifyAccessToken } from '../utils/token.js';
import { getCachedUser, setCachedUser } from '../utils/userCache.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  sid: string;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractAccessToken(req);

  if (!token) {
    throw new AppError('Authentication session is required', 401, 'UNAUTHORIZED');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new AppError('Authentication session is invalid or expired', 401, 'UNAUTHORIZED');
  }

  // Check 60-second in-memory cache for live user status
  let userState = getCachedUser(decoded.sub);

  if (!userState) {
    const userDoc = await User.findById(decoded.sub);
    if (!userDoc || userDoc.status === 'disabled') {
      throw new AppError('User account is invalid or disabled', 401, 'UNAUTHORIZED');
    }

    userState = {
      id: userDoc._id.toString(),
      role: userDoc.role,
      status: userDoc.status,
      mustChangePassword: userDoc.mustChangePassword,
      passwordChangedAt: userDoc.passwordChangedAt || userDoc.createdAt,
      cachedAt: Date.now(),
    };

    setCachedUser(decoded.sub, userState);
  }

  if (userState.status === 'disabled') {
    throw new AppError('User account has been disabled', 401, 'UNAUTHORIZED');
  }

  // Token issued before password was changed
  if (
    userState.passwordChangedAt &&
    new Date(decoded.iat * 1000).getTime() + 1000 < userState.passwordChangedAt.getTime()
  ) {
    throw new AppError('Session invalidated by password change. Please sign in again.', 401, 'UNAUTHORIZED');
  }

  req.user = {
    id: userState.id,
    role: userState.role,
    sid: decoded.sid,
    mustChangePassword: userState.mustChangePassword,
  };

  // Enforce password change guardrail
  if (req.user.mustChangePassword) {
    const allowedPaths = [
      '/auth/me',
      '/api/v1/auth/me',
      '/auth/change-password',
      '/api/v1/auth/change-password',
      '/auth/logout',
      '/api/v1/auth/logout',
      '/auth/logout-all',
      '/api/v1/auth/logout-all',
    ];

    const isAllowed = allowedPaths.some((p) => req.originalUrl.startsWith(p));
    if (!isAllowed) {
      throw new AppError(
        'Password change required before accessing the application.',
        403,
        'PASSWORD_CHANGE_REQUIRED'
      );
    }
  }

  next();
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }

    next();
  };
};
