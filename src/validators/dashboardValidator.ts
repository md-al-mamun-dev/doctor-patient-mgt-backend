import { z } from 'zod';

export const dashboardDateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "from" must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "to" must be in YYYY-MM-DD format')
    .optional(),
});

export const admissionsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "from" must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date "to" must be in YYYY-MM-DD format')
    .optional(),
  interval: z.enum(['day', 'week', 'month']).optional(),
});

export const patientsPerDoctorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type DashboardDateRangeInput = z.infer<typeof dashboardDateRangeSchema>;
export type AdmissionsQueryInput = z.infer<typeof admissionsQuerySchema>;
export type PatientsPerDoctorQueryInput = z.infer<typeof patientsPerDoctorQuerySchema>;

