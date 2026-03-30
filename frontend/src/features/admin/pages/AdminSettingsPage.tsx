import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useGetOrgSettingsQuery, usePatchOrgSettingsMutation } from '@/lib/api/pulseApi';
import type { OrgSettingsDto } from '@/lib/api/pulseApi';

type SettingsForm = {
  organizationName: string;
  defaultRole: OrgSettingsDto['defaultRoleForNewUsers'];
  maxVideoFileSizeMb: number;
  allowedFormats: string;
  sensitivityLevel: OrgSettingsDto['sensitivityLevel'];
  automaticProcessing: boolean;
};

function dtoToForm(d: OrgSettingsDto): SettingsForm {
  return {
    organizationName: d.name,
    defaultRole: d.defaultRoleForNewUsers,
    maxVideoFileSizeMb: d.maxVideoFileSizeMb,
    allowedFormats: d.allowedFormats,
    sensitivityLevel: d.sensitivityLevel,
    automaticProcessing: d.automaticProcessing,
  };
}

export default function AdminSettingsPage() {
  const orgId = useAppSelector((s) => s.auth.organizationId);
  const { data, isLoading, isError, refetch } = useGetOrgSettingsQuery(
    { orgId: orgId ?? '' },
    { skip: !orgId }
  );
  const [patch, { isLoading: isSaving }] = usePatchOrgSettingsMutation();

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [baseline, setBaseline] = useState<SettingsForm | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const next = dtoToForm(data);
      setForm(next);
      setBaseline(next);
      setSavedAt(null);
      setSaveError(null);
    }
  }, [data]);

  const dirty = useMemo(() => {
    if (!form || !baseline) {
      return false;
    }
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, baseline]);

  const save = async () => {
    if (!orgId || !form) {
      return;
    }
    setSaveError(null);
    try {
      const updated = await patch({
        orgId,
        name: form.organizationName,
        defaultRoleForNewUsers: form.defaultRole,
        maxVideoFileSizeMb: form.maxVideoFileSizeMb,
        allowedFormats: form.allowedFormats,
        sensitivityLevel: form.sensitivityLevel,
        automaticProcessing: form.automaticProcessing,
      }).unwrap();
      const next = dtoToForm(updated);
      setForm(next);
      setBaseline(next);
      setSavedAt(new Date().toLocaleTimeString());
      void refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  if (!orgId) {
    return <p>Missing organization ID.</p>;
  }
  if (isLoading || !form) {
    return <p>Loading settings…</p>;
  }
  if (isError) {
    return <p className="error">Could not load organization settings.</p>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>System Settings</h1>
        <button className="btn btn-primary" disabled={!dirty || isSaving} onClick={() => void save()}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      {saveError ? (
        <p className="error" role="alert">
          {saveError}
        </p>
      ) : null}
      {savedAt ? <p className="hint">Saved at {savedAt}</p> : null}
      <p className="hint">
        Configure organization-wide settings and defaults for your application.
      </p>

      <section className="settings-card">
        <h3>Organization Settings</h3>
        <label>
          Organization Name
          <input
            value={form.organizationName}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, organizationName: e.target.value } : prev))}
          />
        </label>
        <label>
          Default Role for New Users
          <select
            value={form.defaultRole}
            onChange={(e) =>
              setForm((prev) =>
                prev
                  ? { ...prev, defaultRole: e.target.value as SettingsForm['defaultRole'] }
                  : prev
              )
            }
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </section>

      <section className="settings-card">
        <h3>Security Settings</h3>
        <div className="settings-grid">
          <label>
            Max Video File Size (MB)
            <input
              type="number"
              min={1}
              value={form.maxVideoFileSizeMb}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, maxVideoFileSizeMb: Number(e.target.value) || 1 } : prev
                )
              }
            />
          </label>
          <label>
            Allowed Video Formats
            <input
              value={form.allowedFormats}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, allowedFormats: e.target.value } : prev))}
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h3>Video Processing</h3>
        <div className="settings-grid">
          <label>
            Sensitivity Level
            <select
              value={form.sensitivityLevel}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        sensitivityLevel: e.target.value as SettingsForm['sensitivityLevel'],
                      }
                    : prev
                )
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Automatic Processing
            <select
              value={form.automaticProcessing ? 'On' : 'Off'}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, automaticProcessing: e.target.value === 'On' } : prev
                )
              }
            >
              <option value="On">On</option>
              <option value="Off">Off</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
