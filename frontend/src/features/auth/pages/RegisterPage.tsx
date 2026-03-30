import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '@/lib/api/pulseApi';
import { setCredentials } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/store/hooks';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [doneOrgId, setDoneOrgId] = useState<string | null>(null);
  const [register, { isLoading, error }] = useRegisterMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tokens = await register({
        email,
        password,
        organizationName,
      }).unwrap();
      dispatch(
        setCredentials({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          organizationId: tokens.organizationId,
          role: tokens.role,
        })
      );
      setDoneOrgId(tokens.organizationId);
    } catch {
      /* surfaced */
    }
  };

  if (doneOrgId) {
    return (
      <div className="auth-shell">
        <div className="auth-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="auth-card">
            <h2 className="auth-title">Welcome to Pulse</h2>
            <p className="hint">
              Save this <strong>organization ID</strong> for signing in on other
              browsers:
            </p>
            <pre className="org-id">{doneOrgId}</pre>
            <div className="auth-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/dashboard', { replace: true })}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="auth-card">
          <h2 className="auth-title">Create an account</h2>
          <p className="hint">
            Sign up to start processing and managing your videos.
          </p>

          <form className="auth-form" onSubmit={onSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </label>
            <label>
              Password (min 8)
              <input
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Organization name
              <input
                value={organizationName}
                onChange={(ev) => setOrganizationName(ev.target.value)}
                required
              />
            </label>

            <div className="auth-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>

          {error != null ? (
            <p className="error">Registration failed (email may be taken).</p>
          ) : null}

          <div className="auth-actions">
            <Link to="/login" className="btn btn-secondary">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
