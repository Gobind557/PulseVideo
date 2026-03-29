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
      <div className="auth-page">
        <h1>Welcome to Pulse</h1>
        <p>
          Save this <strong>organization ID</strong> for signing in on other browsers:
        </p>
        <pre className="org-id">{doneOrgId}</pre>
        <button type="button" onClick={() => navigate('/dashboard', { replace: true })}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Register</h1>
      <p className="hint">
        You will need your organization ID when signing in elsewhere (shown after signup).
      </p>
      <form onSubmit={onSubmit}>
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
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      {error != null ? (
        <p className="error">Registration failed (email may be taken).</p>
      ) : null}
      <p>
        <Link to="/login">Already have an account?</Link>
      </p>
    </div>
  );
}
