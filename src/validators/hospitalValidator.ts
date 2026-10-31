import { z } from 'zod';

export const createHospitalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Hospital name must be at least 2 characters')
    .max(100, 'Hospital name cannot exceed 100 characters'),
});

export const hospitalQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
