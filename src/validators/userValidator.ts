import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .email('Enter a valid email address')
    .trim()
    .toLowerCase(),
  role: z.enum(['admin', 'staff']),
});

export const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    role: z.enum(['admin', 'staff']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .strict()
  .refine(
    (data) => data.name !== undefined || data.role !== undefined || data.status !== undefined,
    {
      message: 'At least one field (name, role, or status) must be provided for update',
    }
  );

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit cannot exceed 100').default(10),
  q: z.string().trim().optional(),
  role: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sort: z.enum(['name', '-createdAt', '-lastLoginAt']).default('-createdAt'),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
