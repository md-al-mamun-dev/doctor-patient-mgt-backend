import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(15, 'Password must be at least 15 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
