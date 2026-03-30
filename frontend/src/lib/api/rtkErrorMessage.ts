import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

type ApiErrorBody = {
  code?: string;
  message?: string;
};

/**
 * RTK Query `unwrap()` rejects with FetchBaseQueryError, not Error — extract API `message` when present.
 */
export function getRtkQueryErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const fe = error as FetchBaseQueryError;
    if (typeof fe.data === 'object' && fe.data !== null && 'message' in fe.data) {
      const msg = (fe.data as ApiErrorBody).message;
      if (typeof msg === 'string' && msg.trim() !== '') {
        return msg;
      }
    }
  }
  return fallback;
}
