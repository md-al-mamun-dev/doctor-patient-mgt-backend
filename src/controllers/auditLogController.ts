import type { Request, Response } from 'express';
import { AuditLogService } from '../services/auditLogService.js';
import { sendSuccess } from '../utils/response.js';
import { auditLogQuerySchema } from '../validators/auditLogValidator.js';

export class AuditLogController {
  static async getLogs(req: Request, res: Response): Promise<void> {
    const query = auditLogQuerySchema.parse(req.query);
    const result = await AuditLogService.getLogs(query);

    sendSuccess(res, {
      statusCode: 200,
      data: result.logs,
      meta: result.meta,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}

