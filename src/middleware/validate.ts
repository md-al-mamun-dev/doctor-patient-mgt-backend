import type { Request, Response, NextFunction } from 'express';
import { type ZodType, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

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
        const parsed = (await schema.query.parseAsync(req.query)) as any;
        for (const key of Object.keys(req.query)) {
          delete (req.query as any)[key];
        }
        Object.assign(req.query, parsed);
      }
      if (schema.params) {
        const parsed = (await schema.params.parseAsync(req.params)) as any;
        Object.assign(req.params, parsed);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        next(new AppError('Some fields need fixing.', 400, 'VALIDATION_ERROR', details));
      } else {
        next(error);
      }
    }
  };
};

