import type { NextFunction, Request, Response } from 'express';
import type { MembershipRole } from '../../infrastructure/db/models/membership.model.js';
import type { OrgService } from './org.service.js';

function paramId(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0]!;
  }
  return '';
}

export class OrgAdminController {
  constructor(private readonly orgService: OrgService) {}

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const members = await this.orgService.listOrgMembers({
        requesterUserId: requester.userId,
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
      });
      res.json(members);
    } catch (e) {
      next(e);
    }
  };

  changeMemberRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const memberUserId = paramId(req.params.userId);
      const body = req.body as { role: MembershipRole };
      await this.orgService.changeMemberRole({
        requesterUserId: requester.userId,
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
        memberUserId,
        role: body.role,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const memberUserId = paramId(req.params.userId);
      await this.orgService.removeOrgMember({
        requesterUserId: requester.userId,
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
        memberUserId,
      });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  };
}

