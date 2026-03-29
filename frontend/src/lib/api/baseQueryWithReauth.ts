import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { fetchBaseQuery, type FetchArgs } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';
import { logout, setCredentials, type AuthSession } from '@/features/auth/authSlice';
import type { MembershipRole } from '@/types/video';

type AuthRoot = {
  auth: {
    accessToken: string | null;
    refreshToken: string | null;
    organizationId: string | null;
  };
};

const mutex = new Mutex();

async function tryRefresh(api: { getState: () => unknown; dispatch: (a: unknown) => void }): Promise<boolean> {
  const state = api.getState() as AuthRoot;
  const { refreshToken, organizationId } = state.auth;
  if (!refreshToken || !organizationId) {
    return false;
  }
  const refreshRes = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, organizationId }),
  });
  if (!refreshRes.ok) {
    return false;
  }
  const tokens = (await refreshRes.json()) as {
    accessToken: string;
    refreshToken: string;
    organizationId: string;
    role: MembershipRole;
  };
  const session: AuthSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    organizationId: tokens.organizationId,
    role: tokens.role,
  };
  api.dispatch(setCredentials(session));
  return true;
}

/**
 * On 401, single-flight refresh then retry; other callers await the mutex and retry once.
 */
export function createBaseQueryWithReauth(): BaseQueryFn<
  string | FetchArgs,
  unknown,
  unknown
> {
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as AuthRoot).auth.accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  });

  return async (args, api, extraOptions) => {
    await mutex.waitForUnlock();
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error && result.error.status === 401) {
      if (!mutex.isLocked()) {
        const release = await mutex.acquire();
        try {
          const refreshed = await tryRefresh(api);
          if (refreshed) {
            result = await rawBaseQuery(args, api, extraOptions);
          } else {
            api.dispatch(logout());
          }
        } finally {
          release();
        }
      } else {
        await mutex.waitForUnlock();
        result = await rawBaseQuery(args, api, extraOptions);
      }
    }

    return result;
  };
}
