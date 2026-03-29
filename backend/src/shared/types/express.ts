import type { MembershipRole } from '../../infrastructure/db/models/membership.model.js';

export type AuthUser = {
  userId: string;
  organizationId: string;
  role: MembershipRole;
};
