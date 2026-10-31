import { Router } from 'express';
import { HospitalController } from '../controllers/hospitalController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createHospitalSchema, hospitalQuerySchema } from '../validators/hospitalValidator.js';

export const hospitalRoutes = Router();

// All hospital operations require authenticated access
hospitalRoutes.use(authenticate);

// 1. Hospital collection operations
hospitalRoutes.get('/', validate({ query: hospitalQuerySchema }), HospitalController.getHospitals);

// 2. Hospital creation requires admin role
hospitalRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: createHospitalSchema }),
  HospitalController.createHospital
);

