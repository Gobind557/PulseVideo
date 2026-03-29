import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLoginMutation } from '@/lib/api/pulseApi';
import { setCredentials } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/store/hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tokens = await login({ email, password, organizationId }).unwrap();
      dispatch(
        setCredentials({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          organizationId: tokens.organizationId,
          role: tokens.role,
        })
      );
      navigate(from, { replace: true });
    } catch {
      /* surfaced via error */
    }
  };

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          Organization ID
          <input
            value={organizationId}
            onChange={(ev) => setOrganizationId(ev.target.value)}
            placeholder="Mongo ObjectId from registration"
            required
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error != null ? (
        <p className="error" role="alert">
          Could not sign in. Check credentials and organization.
        </p>
      ) : null}
      <p>
        <Link to="/register">Create account</Link>
      </p>
    </div>
  );
}
