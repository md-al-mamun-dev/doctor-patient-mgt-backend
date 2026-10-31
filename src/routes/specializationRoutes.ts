import { Router } from 'express';
import { SpecializationController } from '../controllers/specializationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSpecializationSchema, specializationQuerySchema } from '../validators/specializationValidator.js';

export const specializationRoutes = Router();

// All specialization operations require authenticated access
specializationRoutes.use(authenticate);

// 1. Specialization collection operations
specializationRoutes.get('/', validate({ query: specializationQuerySchema }), SpecializationController.getSpecializations);

// 2. Specialization creation requires admin role
specializationRoutes.post(
  '/',
  authorize('admin'),
  validate({ body: createSpecializationSchema }),
  SpecializationController.createSpecialization
);

