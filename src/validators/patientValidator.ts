import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Patient name must be at least 2 characters')
    .max(100, 'Patient name cannot exceed 100 characters'),
  age: z.coerce
    .number()
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(130, 'Age cannot exceed 130'),
  gender: z.enum(['male', 'female', 'other']),
  phone: z
    .string()
    .trim()
    .min(5, 'Phone number is too short')
    .max(30, 'Phone number is too long'),
  email: z
    .string()
    .email('Enter a valid email address')
    .trim()
    .toLowerCase()
    .optional()
    .or(z.literal('')),
  condition: z.enum([
    'stable',
    'under_observation',
    'critical',
    'recovering',
    'discharged',
  ]),
  diagnosis: z
    .string()
    .trim()
    .max(200, 'Diagnosis cannot exceed 200 characters')
    .optional(),
  admissionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must be in YYYY-MM-DD format'),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes cannot exceed 2000 characters')
    .optional(),
});

export const updatePatientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Patient name must be at least 2 characters')
      .max(100, 'Patient name cannot exceed 100 characters')
      .optional(),
    age: z.coerce
      .number()
      .int('Age must be an integer')
      .min(0, 'Age cannot be negative')
      .max(130, 'Age cannot exceed 130')
      .optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
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
      .optional()
      .or(z.literal('')),
    condition: z
      .enum(['stable', 'under_observation', 'critical', 'recovering', 'discharged'])
      .optional(),
    diagnosis: z
      .string()
      .trim()
      .max(200, 'Diagnosis cannot exceed 200 characters')
      .optional(),
    admissionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must be in YYYY-MM-DD format')
      .optional(),
    notes: z
      .string()
      .trim()
      .max(2000, 'Notes cannot exceed 2000 characters')
      .optional(),
    doctorId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid doctor ID format')
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.age !== undefined ||
      data.gender !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined ||
      data.condition !== undefined ||
      data.diagnosis !== undefined ||
      data.admissionDate !== undefined ||
      data.notes !== undefined ||
      data.doctorId !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );

export const patientQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
    doctorId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid doctor ID format')
      .optional(),
    condition: z.string().trim().optional(),
    q: z.string().trim().optional(),
    search: z.string().trim().optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    createdFrom: z.string().trim().optional(),
    createdTo: z.string().trim().optional(),
    sort: z.enum(['-admissionDate', 'admissionDate', 'name']).default('-admissionDate'),
  })
  .transform((data) => ({
    ...data,
    q: data.q || data.search,
    from: data.from || data.createdFrom,
    to: data.to || data.createdTo,
  }));

export const patientIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid patient ID format'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;
