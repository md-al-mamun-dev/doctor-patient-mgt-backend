import type { Request, Response, NextFunction } from 'express';
import { DoctorService } from '../services/doctorService.js';
import { sendSuccess } from '../utils/response.js';

export class DoctorController {
  static async createDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctor = await DoctorService.createDoctor(req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Doctor created successfully',
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDoctors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctors, meta } = await DoctorService.getDoctors(req.query as any);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Doctors retrieved successfully',
        data: doctors,
        meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDoctorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const doctor = await DoctorService.getDoctorById(id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Doctor retrieved successfully',
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const doctor = await DoctorService.updateDoctor(id, req.body);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Doctor updated successfully',
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await DoctorService.deleteDoctor(id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Doctor deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
