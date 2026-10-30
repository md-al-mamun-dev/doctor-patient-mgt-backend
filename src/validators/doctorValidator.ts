import { z } from 'zod';

export const createDoctorSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ObjectId'),
  specialty: z.string().min(2, 'Specialty is required'),
  department: z.string().min(2, 'Department is required'),
  phone: z.string().optional(),
  isAvailable: z.boolean().optional().default(true),
});

export const updateDoctorSchema = createDoctorSchema.partial().omit({ userId: true });

export const doctorQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  specialty: z.string().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type DoctorQueryInput = z.infer<typeof doctorQuerySchema>;

