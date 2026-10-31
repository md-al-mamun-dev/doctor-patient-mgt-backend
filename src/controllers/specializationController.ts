import type { Request, Response } from 'express';
import { Specialization } from '../models/Specialization.js';
import { sendSuccess } from '../utils/response.js';
import { createSpecializationSchema, specializationQuerySchema } from '../validators/specializationValidator.js';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class SpecializationController {
  static async getSpecializations(req: Request, res: Response): Promise<void> {
    const { q, limit = 50 } = specializationQuerySchema.parse(req.query);

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.name = { $regex: escapeRegex(q), $options: 'i' };
    }

    const [specializations, total] = await Promise.all([
      Specialization.find(filter)
        .sort({ name: 1 })
        .limit(limit)
        .exec(),
      Specialization.countDocuments(filter),
    ]);

    sendSuccess(res, {
      statusCode: 200,
      data: specializations,
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

  static async createSpecialization(req: Request, res: Response): Promise<void> {
    const { name } = createSpecializationSchema.parse(req.body);
    const trimmed = name.trim();

    // Check if specialization already exists (case-insensitive)
    let specialization = await Specialization.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
    }).exec();

    if (specialization) {
      sendSuccess(res, {
        statusCode: 200,
        data: specialization,
        message: 'Specialization already exists',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
      return;
    }

    specialization = await Specialization.create({ name: trimmed });

    sendSuccess(res, {
      statusCode: 201,
      data: specialization,
      message: 'Specialization created successfully',
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}

