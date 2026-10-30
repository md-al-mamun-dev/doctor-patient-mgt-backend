import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLogController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { auditLogQuerySchema } from '../validators/auditLogValidator.js';

export const auditLogRoutes = Router();

// Audit log is strictly admin-only and read-only
auditLogRoutes.use(authenticate);
auditLogRoutes.use(authorize('admin'));

auditLogRoutes.get('/', validate({ query: auditLogQuerySchema }), AuditLogController.getLogs);

