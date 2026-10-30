import type { Request, Response } from 'express';
import { DashboardService } from '../services/dashboardService.js';
import { sendSuccess } from '../utils/response.js';
import {
  dashboardDateRangeSchema,
  admissionsQuerySchema,
  patientsPerDoctorQuerySchema,
} from '../validators/dashboardValidator.js';

export class DashboardController {
  static async getSummary(req: Request, res: Response): Promise<void> {
    const query = dashboardDateRangeSchema.parse(req.query);
    const data = await DashboardService.getSummary(query);

    sendSuccess(res, {
      statusCode: 200,
      data,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  static async getAdmissions(req: Request, res: Response): Promise<void> {
    const query = admissionsQuerySchema.parse(req.query);
    const data = await DashboardService.getAdmissions(query);

    sendSuccess(res, {
      statusCode: 200,
      data,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  static async getPatientsPerDoctor(req: Request, res: Response): Promise<void> {
    const query = patientsPerDoctorQuerySchema.parse(req.query);
    const data = await DashboardService.getPatientsPerDoctor(query.limit);

    sendSuccess(res, {
      statusCode: 200,
      data,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  static async getBreakdown(_req: Request, res: Response): Promise<void> {
    const data = await DashboardService.getBreakdown();

    sendSuccess(res, {
      statusCode: 200,
      data,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  static async getStats(_req: Request, res: Response): Promise<void> {
    const stats = await DashboardService.getStats();

    sendSuccess(res, {
      statusCode: 200,
      message: 'Dashboard stats retrieved successfully',
      data: stats,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }
}
