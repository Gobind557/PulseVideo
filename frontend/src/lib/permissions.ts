import type { MembershipRole } from '@/types/video';

export type PermissionAction =
  | 'read'
  | 'upload'
  | 'edit_own'
  | 'edit'
  | 'delete'
  | 'manage_users';

export const permissions: Record<MembershipRole, PermissionAction[]> = {
  viewer: ['read'],
  editor: ['read', 'upload', 'edit_own'],
  admin: ['read', 'upload', 'edit', 'delete', 'manage_users'],
};

export function can(role: MembershipRole | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  return permissions[role]?.includes(action) ?? false;
}

