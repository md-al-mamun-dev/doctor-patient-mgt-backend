import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { routes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './utils/response.js';

export const app: Application = express();

// Global Middlewares
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check
app.get('/health', (_req, res) => {
  sendSuccess(res, {
    message: 'Backend API is running smoothly',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// API Routes
app.use('/api/v1', routes);

// Centralized Error Handler
app.use(errorHandler);

