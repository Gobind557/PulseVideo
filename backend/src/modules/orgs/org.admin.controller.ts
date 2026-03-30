import type { NextFunction, Request, Response } from 'express';
import type { MembershipRole } from '../../infrastructure/db/models/membership.model.js';
import type { Env } from '../../config/env.js';
import type { OrgService } from './org.service.js';
import type { OrgSettings } from '../../infrastructure/db/models/organization.model.js';

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
  constructor(
    private readonly env: Env,
    private readonly orgService: OrgService
  ) {}

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

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const settings = await this.orgService.getOrgSettings({
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
      });
      res.json(settings);
    } catch (e) {
      next(e);
    }
  };

  patchSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const body = req.body as Partial<OrgSettings> & { name?: string };
      const updated = await this.orgService.updateOrgSettings({
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
        patch: body,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  };

  createInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requester = req.user!;
      const orgIdParam = paramId(req.params.orgId);
      const body = req.body as { email?: string; role?: MembershipRole };
      const result = await this.orgService.createOrgInvite({
        requesterUserId: requester.userId,
        requesterOrganizationId: requester.organizationId,
        orgIdParam,
        email: body.email,
        role: body.role,
      });
      const base = this.env.PUBLIC_WEB_URL.replace(/\/$/, '');
      const inviteUrl = `${base}/register?invite=${encodeURIComponent(result.inviteToken)}`;
      res.status(201).json({ ...result, inviteUrl });
    } catch (e) {
      next(e);
    }
  };
}

