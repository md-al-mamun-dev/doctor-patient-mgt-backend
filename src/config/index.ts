import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/doctor_patient_mgt'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const config = _env.data;

