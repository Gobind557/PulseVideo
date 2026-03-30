import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import type { MembershipRole } from '@/types/video';

const ROLE_ORDER: Record<MembershipRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

/** Minimum role aligned with backend requireRole (viewer < editor < admin). */
export function RequireEditor({ children }: { children: React.ReactNode }) {
  const role = useAppSelector((s) => s.auth.role);
  if (!role || ROLE_ORDER[role] < ROLE_ORDER.editor) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const role = useAppSelector((s) => s.auth.role);
  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
