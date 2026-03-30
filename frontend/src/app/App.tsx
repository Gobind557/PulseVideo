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
const AdminSettingsPage = lazy(() => import('@/features/admin/pages/AdminSettingsPage'));

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
      {token ? (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-hamburger" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M12 3l7 4v10l-7 4-7-4V7l7-4z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path d="M12 7v10M5 9l7 4 7-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <div className="sidebar-title">Pulse</div>
          </div>
          <nav className="sidebar-nav">
            <Link className="sidebar-link" to="/dashboard">
              Dashboard
            </Link>
            {role === 'admin' ? (
              <div className="sidebar-admin-section">
                <div className="sidebar-admin-title">ADMIN</div>
                <Link className="sidebar-link" to="/admin/members">
                  User Management
                </Link>
                <Link className="sidebar-link" to="/admin/settings">
                  System Settings
                </Link>
              </div>
            ) : null}
          </nav>
        </aside>
      ) : null}

      <div className="main">
        {token ? (
          <header className="top-bar">
            <div className="top-bar-spacer" />
            <div className="top-bar-actions">
              <button type="button" className="icon-btn" aria-label="Notifications">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 01-3.46 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void doLogout()}>
                Log out
              </button>
            </div>
          </header>
        ) : null}

        {children}
      </div>
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
                    <Navigate to="/admin/settings" replace />
                  </RequireAdmin>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/members"
              element={
                <ProtectedRoute>
                  <RequireAdmin>
                    <AdminMembersPage />
                  </RequireAdmin>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <RequireAdmin>
                    <AdminSettingsPage />
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
