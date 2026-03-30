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
  /** When omitted, the organization's "default role for new users" setting is used. */
  role: z.enum(MEMBERSHIP_ROLE_ORDER).optional() as z.ZodType<MembershipRole | undefined>,
});

export const patchOrgSettingsBodySchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  defaultRoleForNewUsers: z.enum(MEMBERSHIP_ROLE_ORDER).optional() as z.ZodType<
    MembershipRole | undefined
  >,
  maxVideoFileSizeMb: z.number().int().min(1).max(10240).optional(),
  allowedFormats: z.string().max(500).optional(),
  sensitivityLevel: z.enum(['low', 'medium', 'high']).optional(),
  automaticProcessing: z.boolean().optional(),
});

