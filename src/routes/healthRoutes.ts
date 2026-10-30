import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

export const healthRoutes = Router();

export const healthCheckHandler = async (_req: Request, res: Response): Promise<void> => {
  const isConnected = mongoose.connection.readyState === 1;
  let dbUp = false;

  if (isConnected && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().ping();
      dbUp = true;
    } catch {
      dbUp = false;
    }
  }

  if (dbUp) {
    res.status(200).json({
      status: 'ok',
      db: 'up',
      version: '1.4.0',
    });
  } else {
    res.status(503).json({
      status: 'error',
      db: 'down',
      version: '1.4.0',
    });
  }
};

healthRoutes.get('/', healthCheckHandler);

