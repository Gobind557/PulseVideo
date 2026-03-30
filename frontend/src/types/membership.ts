import type { MembershipRole } from './video';

export type OrgMemberDto = {
  userId: string;
  email: string;
  role: MembershipRole;
};

