import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MembershipRole } from '@/types/video';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  role: MembershipRole;
};

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  organizationId: string | null;
  role: MembershipRole | null;
};

const AUTH_KEY = 'pulse_auth';

function readStoredAuth(): Partial<AuthState> {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) {
      return {};
    }
    const p = JSON.parse(raw) as Partial<AuthSession>;
    return {
      accessToken: p.accessToken ?? null,
      refreshToken: p.refreshToken ?? null,
      organizationId: p.organizationId ?? null,
      role: p.role ?? null,
    };
  } catch {
    return {};
  }
}

const defaults: AuthState = {
  accessToken: null,
  refreshToken: null,
  organizationId: null,
  role: null,
};

const initialState: AuthState = { ...defaults, ...readStoredAuth() };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthSession>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.organizationId = action.payload.organizationId;
      state.role = action.payload.role;
      try {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(action.payload));
      } catch {
        /* ignore quota */
      }
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.organizationId = null;
      state.role = null;
      try {
        sessionStorage.removeItem(AUTH_KEY);
      } catch {
        /* ignore */
      }
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export { authSlice };
