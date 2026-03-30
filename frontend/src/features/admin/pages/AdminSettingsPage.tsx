import { useMemo, useState } from 'react';

type SettingsForm = {
  organizationName: string;
  defaultRole: 'viewer' | 'editor' | 'admin';
  maxVideoFileSizeMb: number;
  allowedFormats: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  automaticProcessing: boolean;
};

const STORAGE_KEY = 'pulse.admin.settings.v1';

function getInitialSettings(): SettingsForm {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as SettingsForm;
    } catch {
      // ignore invalid local data
    }
  }
  return {
    organizationName: 'Acme Corp',
    defaultRole: 'viewer',
    maxVideoFileSizeMb: 500,
    allowedFormats: 'MP4, MOV',
    sensitivityLevel: 'medium',
    automaticProcessing: true,
  };
}

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsForm>(getInitialSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = useMemo(() => {
    const snapshot = sessionStorage.getItem(STORAGE_KEY);
    if (!snapshot) return true;
    return snapshot !== JSON.stringify(form);
  }, [form]);

  const save = () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>System Settings</h1>
        <button className="btn btn-primary" disabled={!dirty} onClick={save}>
          Save Changes
        </button>
      </div>
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
            onChange={(e) => setForm((prev) => ({ ...prev, organizationName: e.target.value }))}
          />
        </label>
        <label>
          Default Role for New Users
          <select
            value={form.defaultRole}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, defaultRole: e.target.value as SettingsForm['defaultRole'] }))
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
            Max Video File Size
            <input
              type="number"
              min={1}
              value={form.maxVideoFileSizeMb}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, maxVideoFileSizeMb: Number(e.target.value) || 1 }))
              }
            />
          </label>
          <label>
            Allowed Video Formats
            <input
              value={form.allowedFormats}
              onChange={(e) => setForm((prev) => ({ ...prev, allowedFormats: e.target.value }))}
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
                setForm((prev) => ({
                  ...prev,
                  sensitivityLevel: e.target.value as SettingsForm['sensitivityLevel'],
                }))
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
                setForm((prev) => ({ ...prev, automaticProcessing: e.target.value === 'On' }))
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

