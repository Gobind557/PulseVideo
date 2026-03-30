import { Router } from 'express';
import type { AppContainer } from '../app/container.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createVideoRouter } from '../modules/videos/video.routes.js';
import { createOrgAdminRouter } from '../modules/orgs/org.admin.routes.js';
import { healthRouter } from './health.routes.js';

export function createApiRouter(container: AppContainer): Router {
  const apiRouter = Router();
  apiRouter.use(healthRouter);
  apiRouter.use('/auth', createAuthRouter(container.env, container.authService));
  apiRouter.use('/videos', createVideoRouter(container.env, container.videoService));
  apiRouter.use('/orgs', createOrgAdminRouter(container.env, container.orgService));
  return apiRouter;
}
