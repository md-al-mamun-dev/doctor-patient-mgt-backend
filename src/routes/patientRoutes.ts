import { Router } from 'express';
import { PatientController } from '../controllers/patientController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
} from '../validators/patientValidator.js';

export const patientRoutes = Router();

// Patients list & detail
patientRoutes.get(
  '/',
  authenticate,
  authorize('admin', 'doctor'),
  validate({ query: patientQuerySchema }),
  PatientController.getPatients
);

patientRoutes.get('/:id', authenticate, PatientController.getPatientById);

patientRoutes.post(
  '/',
  authenticate,
  authorize('admin', 'doctor'),
  validate({ body: createPatientSchema }),
  PatientController.createPatient
);

patientRoutes.put(
  '/:id',
  authenticate,
  authorize('admin', 'doctor', 'patient'),
  validate({ body: updatePatientSchema }),
  PatientController.updatePatient
);

patientRoutes.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  PatientController.deletePatient
);

