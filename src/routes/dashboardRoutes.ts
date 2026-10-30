import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  dashboardDateRangeSchema,
  admissionsQuerySchema,
  patientsPerDoctorQuerySchema,
} from '../validators/dashboardValidator.js';

export const dashboardRoutes = Router();

// All dashboard analytics endpoints require signed-in authentication
dashboardRoutes.use(authenticate);

dashboardRoutes.get(
  '/summary',
  validate({ query: dashboardDateRangeSchema }),
  DashboardController.getSummary
);

dashboardRoutes.get(
  '/admissions',
  validate({ query: admissionsQuerySchema }),
  DashboardController.getAdmissions
);

dashboardRoutes.get(
  '/patients-per-doctor',
  validate({ query: patientsPerDoctorQuerySchema }),
  DashboardController.getPatientsPerDoctor
);

dashboardRoutes.get('/breakdown', DashboardController.getBreakdown);

// Legacy route preserved for compatibility
dashboardRoutes.get('/stats', DashboardController.getStats);
