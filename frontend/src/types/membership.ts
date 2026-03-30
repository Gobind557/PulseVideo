import type { MembershipRole } from './video';

export type OrgMemberDto = {
  userId: string;
  email: string;
  role: MembershipRole;
};

export type VideoAssigneeDto = {
  userId: string;
  email: string;
};

