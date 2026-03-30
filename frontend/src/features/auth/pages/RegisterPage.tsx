import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegisterInviteMutation, useRegisterMutation } from '@/lib/api/pulseApi';
import { setCredentials } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/store/hooks';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [doneOrgId, setDoneOrgId] = useState<string | null>(null);
  const [register, { isLoading, error }] = useRegisterMutation();
  const [registerInvite, { isLoading: isInviteLoading, error: inviteError }] =
    useRegisterInviteMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const inviteFromUrl = params.get('invite') ?? '';
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [mode, setMode] = useState<'invite' | 'create'>(inviteFromUrl ? 'invite' : 'create');
  const isInviteMode = mode === 'invite';
  const normalizedInvite = useMemo(() => inviteToken.trim(), [inviteToken]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tokens = isInviteMode
        ? await registerInvite({ email, password, inviteToken: normalizedInvite }).unwrap()
        : await register({ email, password, organizationName }).unwrap();
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
          <h2 className="auth-title">{isInviteMode ? 'Join organization' : 'Create an account'}</h2>
          <p className="hint">
            {isInviteMode
              ? 'You were invited to join an organization. Create your account to continue.'
              : 'Sign up to start processing and managing your videos.'}
          </p>

          <div className="auth-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-secondary ${isInviteMode ? '' : 'btn-primary'}`}
              onClick={() => setMode('create')}
            >
              Create new org
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${isInviteMode ? 'btn-primary' : ''}`}
              onClick={() => setMode('invite')}
            >
              Join with invite
            </button>
            {isInviteMode && inviteFromUrl ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  // Clear invite from URL by navigating to clean /register
                  navigate('/register', { replace: true });
                  setInviteToken('');
                }}
              >
                Clear invite link
              </button>
            ) : null}
          </div>

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
            {isInviteMode ? (
              <label>
                Invite token
                <input
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste invite token"
                  required
                />
              </label>
            ) : (
              <label>
                Organization name
                <input
                  value={organizationName}
                  onChange={(ev) => setOrganizationName(ev.target.value)}
                  required
                />
              </label>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || isInviteLoading}
              >
                {isInviteMode
                  ? isInviteLoading
                    ? 'Joining…'
                    : 'Join'
                  : isLoading
                    ? 'Creating…'
                    : 'Create account'}
              </button>
            </div>
          </form>

          {error != null || inviteError != null ? (
            <p className="error">
              Registration failed (email may be taken or invite is invalid/expired).
            </p>
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
