/** Backend `GET /api/health` JSON body. */
export type ApiHealthResponse = {
  ok: boolean;
  service: string;
};

/** Client-side load state for the health check (feature hooks). */
export type ApiHealthState =
  | { phase: 'loading' }
  | { phase: 'ready'; data: ApiHealthResponse }
  | { phase: 'error'; message: string };
