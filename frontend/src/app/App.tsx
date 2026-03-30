import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, RequireAdmin, RequireEditor } from '@/app/routes/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { useDisconnectSocketOnLogout } from '@/hooks/useVideoRoomSocket';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useLogoutMutation } from '@/lib/api/pulseApi';
import { logout as logoutAction } from '@/features/auth/authSlice';

const DashboardPage = lazy(() => import('@/features/videos/pages/DashboardPage'));
const VideoDetailPage = lazy(() => import('@/features/videos/pages/VideoDetailPage'));
const AdminMembersPage = lazy(() => import('@/features/admin/pages/AdminMembersPage'));

function Shell({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const role = useAppSelector((s) => s.auth.role);
  const dispatch = useAppDispatch();
  const [logoutApi] = useLogoutMutation();

  useDisconnectSocketOnLogout(!!token);

  const doLogout = async () => {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken).unwrap();
      } catch {
        /* still clear client session */
      }
    }
    dispatch(logoutAction());
  };

  return (
    <div className="app-shell">
      {token && (
        <nav className="top-nav">
          <div className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            {role === 'admin' ? <Link to="/admin">Admin</Link> : null}
          </div>
          <button type="button" onClick={() => void doLogout()}>
            Log out
          </button>
        </nav>
      )}
      {children}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<p className="loading">Loading…</p>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/videos/:id"
              element={
                <ProtectedRoute>
                  <VideoDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <RequireEditor>
                    <Navigate to="/dashboard" replace />
                  </RequireEditor>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RequireAdmin>
                    <AdminMembersPage />
                  </RequireAdmin>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  );
}
