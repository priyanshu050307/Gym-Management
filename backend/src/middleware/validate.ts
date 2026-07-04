import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Middleware factory that validates req[target] against a Zod schema.
 * On failure, returns 400 with structured field errors.
 * On success, replaces req[target] with the parsed (coerced) value.
 */
export const validate =
  (schema: ZodSchema, target: ValidationTarget = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }
    // Replace with parsed + coerced data
    (req as any)[target] = result.data;
    next();
  };
