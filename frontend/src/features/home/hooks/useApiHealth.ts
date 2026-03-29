import { useEffect, useState } from 'react';
import type { ApiHealthResponse, ApiHealthState } from '@/shared/types';
import { fetchApiHealth } from '../api/fetchApiHealth';

/**
 * Fetches API health once on mount. Data layer only — no UI strings here.
 */
export function useApiHealth(): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });

    fetchApiHealth()
      .then((data: ApiHealthResponse) => {
        if (!cancelled) setState({ phase: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setState({ phase: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
