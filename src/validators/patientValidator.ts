import { z } from 'zod';

export const createPatientSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ObjectId'),
  doctorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ObjectId').optional(),
  age: z.number().int().min(0, 'Age must be non-negative'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.string().optional(),
  medicalHistory: z.array(z.string()).optional(),
});

export const updatePatientSchema = createPatientSchema.partial().omit({ userId: true });

export const patientQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  doctorId: z.string().optional(),
  gender: z.string().optional(),
  search: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;

