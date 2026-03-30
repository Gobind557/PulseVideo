import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../shared/errors.js';

/** Keeps validation out of controllers: failed parses become consistent AppError. */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError('VALIDATION_ERROR', 'Validation failed', 422, parsed.error.flatten())
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new AppError('VALIDATION_ERROR', 'Validation failed', 422, parsed.error.flatten())
      );
      return;
    }
    req.query = parsed.data as typeof req.query;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      next(
        new AppError('VALIDATION_ERROR', 'Validation failed', 422, parsed.error.flatten())
      );
      return;
    }
    req.params = parsed.data as typeof req.params;
    next();
  };
}
