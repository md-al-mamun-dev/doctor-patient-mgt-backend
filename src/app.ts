import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { routes } from './routes/index.js';
import { docsRoutes } from './routes/docsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requireOrigin, requireJson } from './middleware/requireHeaders.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { sendSuccess } from './utils/response.js';

export const app: Application = express();

// 1. Request ID Tracking
app.use(requestIdMiddleware);

// 1.1 HTTP Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(
      `[${new Date().toISOString()}] [${req.id.slice(0, 8)}] ${req.method} ${req.originalUrl} -> ${color}${res.statusCode}${reset} (${duration}ms)`
    );
  });
  next();
});

// 2. Global Security & Body Parsing
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. State-changing request header guardrails
app.use(requireOrigin);
app.use(requireJson);

// 4. API Documentation (Redoc UI & OpenAPI specification)
app.use(docsRoutes);

// 5. Health Check
app.get('/health', (_req, res) => {
  sendSuccess(res, {
    message: 'Backend API is running smoothly',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// 6. Rate Limited API v1 Routes
app.use('/api/v1', apiRateLimiter, routes);

// 7. Centralized Error Handler
app.use(errorHandler);
