import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
  actorId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid actor ID format')
    .optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid entity ID format')
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "from" must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "to" must be in YYYY-MM-DD format')
    .optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

