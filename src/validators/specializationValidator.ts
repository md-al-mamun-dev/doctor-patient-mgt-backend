import { z } from 'zod';

export const createSpecializationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Specialization name must be at least 2 characters')
    .max(100, 'Specialization name cannot exceed 100 characters'),
});

export const specializationQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

