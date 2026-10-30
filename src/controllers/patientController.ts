import type { Request, Response } from 'express';
import { PatientService } from '../services/patientService.js';
import { sendSuccess } from '../utils/response.js';
import {
  updatePatientSchema,
  patientQuerySchema,
  patientIdParamSchema,
} from '../validators/patientValidator.js';

export class PatientController {
  static async getPatients(req: Request, res: Response): Promise<void> {
    const query = patientQuerySchema.parse(req.query);
    const result = await PatientService.getPatients(query);

    sendSuccess(res, {
      statusCode: 200,
      data: result.patients,
      meta: result.meta,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getPatientById(req: Request, res: Response): Promise<void> {
    const { id } = patientIdParamSchema.parse(req.params);
    const patient = await PatientService.getPatientById(id);

    sendSuccess(res, {
      statusCode: 200,
      data: patient,
      headers: {
        ETag: `"${patient.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async updatePatient(req: Request, res: Response): Promise<void> {
    const { id } = patientIdParamSchema.parse(req.params);
    const input = updatePatientSchema.parse(req.body);
    const expectedVersion = (req as any).expectedVersion;
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const updated = await PatientService.updatePatient(
      id,
      input,
      expectedVersion,
      actorId,
      ip,
      userAgent
    );

    sendSuccess(res, {
      statusCode: 200,
      data: updated,
      headers: {
        ETag: `"${updated.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async deletePatient(req: Request, res: Response): Promise<void> {
    const { id } = patientIdParamSchema.parse(req.params);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    await PatientService.deletePatient(id, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 204,
    });
  }
}
