import { useMemo } from 'react';
import { can } from '@/lib/permissions';
import { useAppSelector } from '@/store/hooks';
import type { MembershipRole } from '@/types/video';

export function useRBAC() {
  const role = useAppSelector((s) => s.auth.role) as MembershipRole | null;

  return useMemo(() => {
    const canUpload = can(role, 'upload');
    const canEdit = can(role, 'edit') || can(role, 'edit_own');
    const canDelete = can(role, 'delete');
    const isViewer = role === 'viewer';
    const isAdmin = role === 'admin';
    const isEditor = role === 'editor';

    return {
      role,
      canUpload,
      canEdit,
      canDelete,
      isViewer,
      isEditor,
      isAdmin,
    };
  }, [role]);
}

