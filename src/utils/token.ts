import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Response, Request } from 'express';
import { config } from '../config/index.js';

export interface TokenPayload {
  sub: string;
  role: string;
  sid: string;
}

export interface DecodedToken extends TokenPayload {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

const JWT_ISSUER = 'doctortracker';
const JWT_AUDIENCE = 'doctortracker';
const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_MAX_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export const isProduction = config.NODE_ENV === 'production';

// Cookie names
export const ACCESS_COOKIE_NAME = isProduction ? '__Host-dt_access' : 'dt_access';
export const REFRESH_COOKIE_NAME = isProduction ? '__Secure-dt_refresh' : 'dt_refresh';
export const SESSION_HINT_COOKIE_NAME = 'dt_session';

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
};

export const verifyAccessToken = (token: string): DecodedToken => {
  return jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as DecodedToken;
};

export const calculateTokenExpiresAt = (familyStartedAt: Date): Date => {
  const idleExpiration = new Date(Date.now() + REFRESH_IDLE_TTL_MS);
  const maxSessionExpiration = new Date(familyStartedAt.getTime() + SESSION_MAX_TTL_MS);
  return idleExpiration < maxSessionExpiration ? idleExpiration : maxSessionExpiration;
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  sessionExpiresAt: Date
): void => {
  const accessMaxAgeMs = ACCESS_TOKEN_TTL_SEC * 1000;
  const sessionMaxAgeMs = Math.max(0, sessionExpiresAt.getTime() - Date.now());

  // 1. Access Token Cookie
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAgeMs,
  });

  // 2. Refresh Token Cookie (scoped strictly to /api/v1/auth)
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: sessionMaxAgeMs,
  });

  // 3. Session Hint Cookie (readable by client guards if needed, or lax)
  res.cookie(SESSION_HINT_COOKIE_NAME, '1', {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMaxAgeMs,
  });
};

export const clearAuthCookies = (res: Response, clearSiteData = false): void => {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
  res.clearCookie(SESSION_HINT_COOKIE_NAME, { path: '/' });

  // Clear legacy cookie names if present
  res.clearCookie('token', { path: '/' });
  res.clearCookie('dt_access', { path: '/' });
  res.clearCookie('dt_refresh', { path: '/api/v1/auth' });

  if (clearSiteData) {
    res.setHeader('Clear-Site-Data', '"cookies", "storage"');
  }
};

export const extractAccessToken = (req: Request): string | null => {
  // 1. Check cookies first
  if (req.cookies?.[ACCESS_COOKIE_NAME]) {
    return req.cookies[ACCESS_COOKIE_NAME];
  }
  if (req.cookies?.dt_access) {
    return req.cookies.dt_access;
  }
  // 2. Fall back to Bearer header for tests and API tools
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
};

export const extractRefreshToken = (req: Request): string | null => {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.cookies?.dt_refresh || null;
};

