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
  const ctrl = new OrgAdminController(env, orgService);

  router.use(auth);
  router.use(requireRole('admin'));

  router.get(
    '/:orgId/settings',
    validateParams(listMembersParamsSchema),
    ctrl.getSettings
  );

  router.patch(
    '/:orgId/settings',
    validateParams(listMembersParamsSchema),
    validateBody(patchOrgSettingsBodySchema),
    ctrl.patchSettings
  );

  router.get(
    '/:orgId/members',
    validateParams(listMembersParamsSchema),
    ctrl.listMembers
  );

  router.patch(
    '/:orgId/members/:userId/role',
    validateParams(memberRoleParamsSchema),
    validateBody(changeMemberRoleBodySchema),
    ctrl.changeMemberRole
  );

  router.delete(
    '/:orgId/members/:userId',
    validateParams(memberRoleParamsSchema),
    ctrl.removeMember
  );

  router.post(
    '/:orgId/invites',
    validateParams(listMembersParamsSchema),
    validateBody(createInviteBodySchema),
    ctrl.createInvite
  );

  return router;
}

