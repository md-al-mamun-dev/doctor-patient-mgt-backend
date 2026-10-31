import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // 10 in production, relaxed in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      requestId: req.id,
    });
  },
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many token refresh attempts. Please slow down.',
      requestId: req.id,
    });
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 5000, // 300 in production, relaxed in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      requestId: req.id,
    });
  },
});

