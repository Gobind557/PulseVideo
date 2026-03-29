import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { notFoundHandler } from '../middleware/notFound.js';
import { createApiRouter } from '../routes/index.js';
import type { AppContainer } from './container.js';

export function createApp(env: Env, container: AppContainer) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', createApiRouter(container));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
