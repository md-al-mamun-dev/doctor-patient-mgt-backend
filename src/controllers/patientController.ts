import type { Request, Response, NextFunction } from 'express';
import { PatientService } from '../services/patientService.js';
import { sendSuccess } from '../utils/response.js';

export class PatientController {
  static async createPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patient = await PatientService.createPatient(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Patient created successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patients, meta } = await PatientService.getPatients(req.query as any);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Patients retrieved successfully',
        data: patients,
        meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const patient = await PatientService.getPatientById(id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Patient retrieved successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const patient = await PatientService.updatePatient(id, req.body);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Patient updated successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deletePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await PatientService.deletePatient(id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Patient deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
