import type { Request, Response } from 'express';
import { Hospital } from '../models/Hospital.js';
import { sendSuccess } from '../utils/response.js';
import { createHospitalSchema, hospitalQuerySchema } from '../validators/hospitalValidator.js';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class HospitalController {
  static async getHospitals(req: Request, res: Response): Promise<void> {
    const { q, limit = 50 } = hospitalQuerySchema.parse(req.query);

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.name = { $regex: escapeRegex(q), $options: 'i' };
    }

    const [hospitals, total] = await Promise.all([
      Hospital.find(filter)
        .sort({ name: 1 })
        .limit(limit)
        .exec(),
      Hospital.countDocuments(filter),
    ]);

    sendSuccess(res, {
      statusCode: 200,
      data: hospitals,
      meta: {
        page: 1,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: total > limit,
      },
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async createHospital(req: Request, res: Response): Promise<void> {
    const { name } = createHospitalSchema.parse(req.body);
    const trimmed = name.trim();

    // Check if hospital already exists (case-insensitive)
    let hospital = await Hospital.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
    }).exec();

    if (hospital) {
      sendSuccess(res, {
        statusCode: 200,
        data: hospital,
        message: 'Hospital already exists',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
      return;
    }

    hospital = await Hospital.create({ name: trimmed });

    sendSuccess(res, {
      statusCode: 201,
      data: hospital,
      message: 'Hospital created successfully',
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
