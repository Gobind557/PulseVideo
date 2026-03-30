import { useMemo, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import type { MembershipRole } from '@/types/video';
import { useChangeMemberRoleMutation, useGetOrgMembersQuery, useRemoveOrgMemberMutation } from '@/lib/api/pulseApi';
import type { OrgMemberDto } from '@/types/membership';

function decodeJwtSub(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const ROLE_OPTIONS: MembershipRole[] = ['viewer', 'editor', 'admin'];

export default function AdminMembersPage() {
  const role = useAppSelector((s) => s.auth.role);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const orgId = useAppSelector((s) => s.auth.organizationId);
  const currentUserId = useMemo(() => (accessToken ? decodeJwtSub(accessToken) : null), [accessToken]);

  const { data: members, isLoading, error, refetch } = useGetOrgMembersQuery(
    { orgId: orgId ?? '' },
    { skip: !orgId }
  );

  const [changeRole, { isLoading: isChanging }] = useChangeMemberRoleMutation();
  const [removeMember, { isLoading: isRemoving }] = useRemoveOrgMemberMutation();
  const [uiError, setUiError] = useState<string | null>(null);

  const canEditRoles = role === 'admin';

  const onChangeRole = async (member: OrgMemberDto, nextRole: MembershipRole) => {
    if (!orgId) return;
    setUiError(null);
    try {
      await changeRole({ orgId, userId: member.userId, role: nextRole }).unwrap();
      await refetch();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : 'Role change failed');
    }
  };

  const onRemove = async (member: OrgMemberDto) => {
    if (!orgId) return;
    if (member.userId === currentUserId) {
      setUiError('You cannot remove yourself.');
      return;
    }
    const ok = window.confirm(`Remove ${member.email}?`);
    if (!ok) return;
    setUiError(null);
    try {
      await removeMember({ orgId, userId: member.userId }).unwrap();
      await refetch();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  if (!orgId) {
    return <p>Missing organization ID.</p>;
  }
  if (isLoading) {
    return <p>Loading members…</p>;
  }
  if (error || !members) {
    return <p className="error">Could not load members.</p>;
  }

  return (
    <div className="admin-page">
      <header className="dashboard-header">
        <div>
          <h1>Admin - Organization Members</h1>
          <p className="hint">Manage roles for your organization.</p>
        </div>
      </header>

      {uiError && (
        <p className="error" role="alert">
          {uiError}
        </p>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>User ID</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            return (
              <tr key={m.userId}>
                <td>
                  {m.email} {isMe ? <strong>(you)</strong> : null}
                </td>
                <td className="mono">{m.userId}</td>
                <td>
                  <select
                    value={m.role}
                    disabled={!canEditRoles || isMe || isChanging}
                    onChange={(e) => {
                      const next = e.target.value as MembershipRole;
                      void onChangeRole(m, next);
                    }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option value={r} key={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    disabled={!canEditRoles || isRemoving || isMe}
                    onClick={() => void onRemove(m)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

