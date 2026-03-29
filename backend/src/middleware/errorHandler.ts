import type { ErrorRequestHandler } from 'express';
import { AppError, RangeNotSatisfiableError } from '../shared/errors.js';

/**
 * Single JSON shape for clients; AppError carries stable `code` + optional details.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof RangeNotSatisfiableError) {
    res.setHeader('Content-Range', `bytes */${err.resourceSize}`);
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  console.error(err);
  const isDev = process.env.NODE_ENV !== 'production';
  const message =
    isDev && err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ code: 'SERVER_ERROR', message });
};
