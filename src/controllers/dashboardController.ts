import type { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService.js';
import { sendSuccess } from '../utils/response.js';

export class DashboardController {
  static async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DashboardService.getStats();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Dashboard stats retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

