import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { validateBody } from '../../middleware/validate.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import {
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './auth.schemas.js';

export function createAuthRouter(_env: Env, authService: AuthService): Router {
  const router = Router();
  const ctrl = new AuthController(authService);

  router.post('/register', validateBody(registerBodySchema), ctrl.register);
  router.post('/login', validateBody(loginBodySchema), ctrl.login);
  router.post('/refresh', validateBody(refreshBodySchema), ctrl.refresh);
  router.post('/logout', validateBody(logoutBodySchema), ctrl.logout);

  return router;
}
