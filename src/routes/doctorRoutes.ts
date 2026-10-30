import { Router } from 'express';
import { DoctorController } from '../controllers/doctorController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  doctorQuerySchema,
} from '../validators/doctorValidator.js';

export const doctorRoutes = Router();

doctorRoutes.get('/', validate({ query: doctorQuerySchema }), DoctorController.getDoctors);
doctorRoutes.get('/:id', DoctorController.getDoctorById);

// Protected routes
doctorRoutes.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createDoctorSchema }),
  DoctorController.createDoctor
);

doctorRoutes.put(
  '/:id',
  authenticate,
  authorize('admin', 'doctor'),
  validate({ body: updateDoctorSchema }),
  DoctorController.updateDoctor
);

doctorRoutes.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  DoctorController.deleteDoctor
);

