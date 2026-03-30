export default function AdminSettingsPage() {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>System Settings</h1>
        <button className="btn btn-primary">Save Changes</button>
      </div>
      <p className="hint">
        Configure organization-wide settings and defaults for your application.
      </p>

      <section className="settings-card">
        <h3>Organization Settings</h3>
        <label>
          Organization Name
          <input value="Acme Corp" readOnly />
        </label>
        <label>
          Default Role for New Users
          <select value="viewer" disabled>
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
            <input value="500 MB" readOnly />
          </label>
          <label>
            Allowed Video Formats
            <input value="MP4, MOV" readOnly />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h3>Video Processing</h3>
        <div className="settings-grid">
          <label>
            Sensitivity Level
            <select value="medium" disabled>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Automatic Processing
            <input value="On" readOnly />
          </label>
        </div>
      </section>
    </div>
  );
}

