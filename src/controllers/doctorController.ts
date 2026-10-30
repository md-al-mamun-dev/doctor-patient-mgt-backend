import type { Request, Response } from 'express';
import { DoctorService } from '../services/doctorService.js';
import { sendSuccess } from '../utils/response.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  doctorQuerySchema,
  doctorIdParamSchema,
  doctorOptionsQuerySchema,
} from '../validators/doctorValidator.js';
import { createPatientSchema, patientQuerySchema } from '../validators/patientValidator.js';

export class DoctorController {
  static async getDoctors(req: Request, res: Response): Promise<void> {
    const query = doctorQuerySchema.parse(req.query);
    const result = await DoctorService.getDoctors(query);

    sendSuccess(res, {
      statusCode: 200,
      data: result.doctors,
      meta: result.meta,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async createDoctor(req: Request, res: Response): Promise<void> {
    const input = createDoctorSchema.parse(req.body);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const doctor = await DoctorService.createDoctor(input, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 201,
      data: doctor,
      headers: {
        Location: `/api/v1/doctors/${doctor.id}`,
        ETag: `"${doctor.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getDoctorOptions(req: Request, res: Response): Promise<void> {
    const query = doctorOptionsQuerySchema.parse(req.query);
    const options = await DoctorService.getDoctorOptions(query);

    sendSuccess(res, {
      statusCode: 200,
      data: options,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getDoctorFacets(_req: Request, res: Response): Promise<void> {
    const facets = await DoctorService.getDoctorFacets();

    sendSuccess(res, {
      statusCode: 200,
      data: facets,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getDoctorById(req: Request, res: Response): Promise<void> {
    const { id } = doctorIdParamSchema.parse(req.params);
    const doctor = await DoctorService.getDoctorById(id);

    sendSuccess(res, {
      statusCode: 200,
      data: doctor,
      headers: {
        ETag: `"${doctor.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async updateDoctor(req: Request, res: Response): Promise<void> {
    const { id } = doctorIdParamSchema.parse(req.params);
    const input = updateDoctorSchema.parse(req.body);
    const expectedVersion = (req as any).expectedVersion;
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const updated = await DoctorService.updateDoctor(
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

  static async getDoctorSummary(req: Request, res: Response): Promise<void> {
    const { id } = doctorIdParamSchema.parse(req.params);
    const summary = await DoctorService.getDoctorSummary(id);

    sendSuccess(res, {
      statusCode: 200,
      data: summary,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getDoctorPatients(req: Request, res: Response): Promise<void> {
    const { id } = doctorIdParamSchema.parse(req.params);
    const query = patientQuerySchema.parse(req.query);
    const result = await DoctorService.getDoctorPatients(id, query);

    sendSuccess(res, {
      statusCode: 200,
      data: result.patients,
      meta: result.meta,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async createDoctorPatient(req: Request, res: Response): Promise<void> {
    const { id } = doctorIdParamSchema.parse(req.params);
    const input = createPatientSchema.parse(req.body);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const patient = await DoctorService.createDoctorPatient(id, input, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 201,
      data: patient,
      headers: {
        Location: `/api/v1/patients/${patient.id}`,
        ETag: `"${patient.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
}
