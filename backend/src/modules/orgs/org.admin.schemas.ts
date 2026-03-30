import { z } from 'zod';
import type { MembershipRole } from '../../infrastructure/db/models/membership.model.js';
import { MEMBERSHIP_ROLE_ORDER } from '../../infrastructure/db/models/membership.model.js';
import { objectIdSchema } from '../../shared/zod/objectId.js';

export const orgIdParamSchema = objectIdSchema;

export const memberUserIdParamSchema = objectIdSchema;

export const listMembersParamsSchema = z.object({
  orgId: orgIdParamSchema,
});

export const memberRoleParamsSchema = z.object({
  orgId: orgIdParamSchema,
  userId: memberUserIdParamSchema,
});

export const changeMemberRoleBodySchema = z.object({
  role: z.enum(MEMBERSHIP_ROLE_ORDER) as z.ZodType<MembershipRole>,
});

export const createInviteBodySchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(MEMBERSHIP_ROLE_ORDER).default('viewer') as z.ZodType<MembershipRole>,
});

