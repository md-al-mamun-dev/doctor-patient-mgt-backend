import type { Request, Response, NextFunction } from 'express';
import { type ZodType, ZodError } from 'zod';
import { AppError } from '../utils/logger.js';

interface RequestValidationSchema {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validate = (schema: RequestValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as any;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        next(new AppError('Input validation failed', 400, errors));
      } else {
        next(error);
      }
    }
  };
};

