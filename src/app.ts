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
