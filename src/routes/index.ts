import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { userRoutes } from './userRoutes.js';
import { doctorRoutes } from './doctorRoutes.js';
import { patientRoutes } from './patientRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { auditLogRoutes } from './auditLogRoutes.js';
import { healthRoutes } from './healthRoutes.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/users', userRoutes);
routes.use('/doctors', doctorRoutes);
routes.use('/patients', patientRoutes);
routes.use('/dashboard', dashboardRoutes);
routes.use('/audit-logs', auditLogRoutes);
routes.use('/health', healthRoutes);

