import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found' });
};
