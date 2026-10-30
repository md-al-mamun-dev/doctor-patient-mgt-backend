import { Router } from 'express';
import { DoctorController } from '../controllers/doctorController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireIfMatch } from '../middleware/requireHeaders.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  doctorQuerySchema,
  doctorIdParamSchema,
  doctorOptionsQuerySchema,
} from '../validators/doctorValidator.js';
import { createPatientSchema, patientQuerySchema } from '../validators/patientValidator.js';

export const doctorRoutes = Router();

// All doctor operations require authenticated access
doctorRoutes.use(authenticate);

// 1. Static/Option routes registered BEFORE /:id parameter
doctorRoutes.get('/options', validate({ query: doctorOptionsQuerySchema }), DoctorController.getDoctorOptions);
doctorRoutes.get('/facets', DoctorController.getDoctorFacets);

// 2. Doctor collection operations
doctorRoutes.get('/', validate({ query: doctorQuerySchema }), DoctorController.getDoctors);
doctorRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: createDoctorSchema }),
  DoctorController.createDoctor
);

// 3. Sub-resource and parameterized doctor operations
doctorRoutes.get('/:id/summary', validate({ params: doctorIdParamSchema }), DoctorController.getDoctorSummary);
doctorRoutes.get(
  '/:id/patients',
  validate({ params: doctorIdParamSchema, query: patientQuerySchema }),
  DoctorController.getDoctorPatients
);
doctorRoutes.post(
  '/:id/patients',
  authorize('admin'),
  validate({ params: doctorIdParamSchema, body: createPatientSchema }),
  DoctorController.createDoctorPatient
);

doctorRoutes.get('/:id', validate({ params: doctorIdParamSchema }), DoctorController.getDoctorById);
doctorRoutes.patch(
  '/:id',
  authorize('admin'),
  requireIfMatch,
  validate({ params: doctorIdParamSchema, body: updateDoctorSchema }),
  DoctorController.updateDoctor
);
