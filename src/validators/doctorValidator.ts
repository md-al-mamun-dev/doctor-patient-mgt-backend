import { z } from 'zod';

export const createDoctorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Doctor name must be at least 2 characters')
    .max(100, 'Doctor name cannot exceed 100 characters'),
  specialization: z
    .string()
    .trim()
    .min(2, 'Specialization must be at least 2 characters')
    .max(100, 'Specialization cannot exceed 100 characters'),
  hospital: z
    .string()
    .trim()
    .min(2, 'Hospital must be at least 2 characters')
    .max(100, 'Hospital cannot exceed 100 characters'),
  phone: z
    .string()
    .trim()
    .min(5, 'Phone number is too short')
    .max(30, 'Phone number is too long'),
  email: z
    .string()
    .email('Enter a valid email address')
    .trim()
    .toLowerCase(),
});

export const updateDoctorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Doctor name must be at least 2 characters')
      .max(100, 'Doctor name cannot exceed 100 characters')
      .optional(),
    specialization: z
      .string()
      .trim()
      .min(2, 'Specialization must be at least 2 characters')
      .max(100, 'Specialization cannot exceed 100 characters')
      .optional(),
    hospital: z
      .string()
      .trim()
      .min(2, 'Hospital must be at least 2 characters')
      .max(100, 'Hospital cannot exceed 100 characters')
      .optional(),
    phone: z
      .string()
      .trim()
      .min(5, 'Phone number is too short')
      .max(30, 'Phone number is too long')
      .optional(),
    email: z
      .string()
      .email('Enter a valid email address')
      .trim()
      .toLowerCase()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.specialization !== undefined ||
      data.hospital !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );

export const doctorQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
  q: z.string().trim().optional(),
  specialization: z.string().trim().optional(),
  hospital: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  sort: z
    .enum(['-createdAt', 'createdAt', 'name', '-name', '-patientCount'])
    .default('-createdAt'),
});

export const doctorIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid doctor ID format'),
});

export const doctorOptionsQuerySchema = z.object({
  q: z.string().trim().optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type DoctorQueryInput = z.infer<typeof doctorQuerySchema>;
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;
export type DoctorOptionsQueryInput = z.infer<typeof doctorOptionsQuerySchema>;
