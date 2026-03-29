import type { ApiHealthState } from '@/shared/types';

export type HomeViewProps = {
  appName: string;
  health: ApiHealthState;
};

function healthDisplayText(health: ApiHealthState): string {
  switch (health.phase) {
    case 'loading':
      return 'Checking…';
    case 'ready':
      return health.data.ok ? `${health.data.service} OK` : 'Unexpected response';
    case 'error':
      return `${health.message} (check API and MongoDB)`;
  }
}

/** Presentational only: layout + copy. No data fetching or Redux. */
export function HomeView({ appName, health }: HomeViewProps) {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 640 }}>
      <h1 style={{ marginTop: 0 }}>{appName}</h1>
      <p style={{ color: '#444' }}>Monorepo scaffold — upload, processing, and streaming come next.</p>
      <p>
        <strong>API health:</strong> {healthDisplayText(health)}
      </p>
    </main>
  );
}
