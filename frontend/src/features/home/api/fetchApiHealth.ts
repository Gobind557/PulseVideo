import type { ApiHealthResponse } from '@/shared/types';

/**
 * Pure transport: GET /api/health (Vite dev proxy → backend).
 * No React; throws on non-OK HTTP.
 */
export async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<ApiHealthResponse>;
}
