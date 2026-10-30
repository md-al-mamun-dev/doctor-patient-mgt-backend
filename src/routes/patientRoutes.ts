import { Router } from 'express';
import { PatientController } from '../controllers/patientController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireIfMatch } from '../middleware/requireHeaders.js';
import {
  updatePatientSchema,
  patientQuerySchema,
  patientIdParamSchema,
} from '../validators/patientValidator.js';

export const patientRoutes = Router();

// All patient endpoints require signed-in authentication
patientRoutes.use(authenticate);

patientRoutes.get('/', validate({ query: patientQuerySchema }), PatientController.getPatients);

patientRoutes.get('/:id', validate({ params: patientIdParamSchema }), PatientController.getPatientById);

patientRoutes.patch(
  '/:id',
  authorize('admin'),
  requireIfMatch,
  validate({ params: patientIdParamSchema, body: updatePatientSchema }),
  PatientController.updatePatient
);

patientRoutes.delete(
  '/:id',
  authorize('admin'),
  validate({ params: patientIdParamSchema }),
  PatientController.deletePatient
);
