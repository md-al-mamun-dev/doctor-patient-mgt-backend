import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { doctorRoutes } from './doctorRoutes.js';
import { patientRoutes } from './patientRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/doctors', doctorRoutes);
routes.use('/patients', patientRoutes);
routes.use('/dashboard', dashboardRoutes);

