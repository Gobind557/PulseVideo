import { Router } from 'express';
import type { Env } from '../../config/env.js';
import type { OrgService } from './org.service.js';
import { authenticateJWT } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  changeMemberRoleBodySchema,
  createInviteBodySchema,
  listMembersParamsSchema,
  memberRoleParamsSchema,
  patchOrgSettingsBodySchema,
} from './org.admin.schemas.js';
import { OrgAdminController } from './org.admin.controller.js';

export function createOrgAdminRouter(env: Env, orgService: OrgService): Router {
  const router = Router();
  const auth = authenticateJWT(env);
  const ctrl = new OrgAdminController(orgService);

  router.use(auth);

  router.get(
    '/:orgId/settings',
    validateParams(listMembersParamsSchema),
    requireRole('viewer'),
    ctrl.getSettings
  );

  router.patch(
    '/:orgId/settings',
    validateParams(listMembersParamsSchema),
    requireRole('admin'),
    validateBody(patchOrgSettingsBodySchema),
    ctrl.patchSettings
  );

  router.get(
    '/:orgId/members',
    validateParams(listMembersParamsSchema),
    requireRole('admin'),
    ctrl.listMembers
  );

  router.patch(
    '/:orgId/members/:userId/role',
    validateParams(memberRoleParamsSchema),
    requireRole('admin'),
    validateBody(changeMemberRoleBodySchema),
    ctrl.changeMemberRole
  );

  router.delete(
    '/:orgId/members/:userId',
    validateParams(memberRoleParamsSchema),
    requireRole('admin'),
    ctrl.removeMember
  );

  router.post(
    '/:orgId/invites',
    validateParams(listMembersParamsSchema),
    requireRole('admin'),
    validateBody(createInviteBodySchema),
    ctrl.createInvite
  );

  return router;
}

