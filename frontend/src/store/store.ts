import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { pulseApi } from '@/lib/api/pulseApi';
import { authSlice, logout, setCredentials } from '@/features/auth/authSlice';
import { uploadSlice } from '@/features/upload/uploadSlice';
import { appSlice } from './appSlice';

const authChangeResetMiddleware: Middleware = (api) => (next) => (action) => {
  const prevState = api.getState() as {
    auth?: { accessToken: string | null; organizationId: string | null; role: unknown };
  };
  const prevAuth = prevState.auth;

  const result = next(action);

  if (setCredentials.match(action) || logout.match(action)) {
    const nextState = api.getState() as {
      auth?: { accessToken: string | null; organizationId: string | null; role: unknown };
    };
    const nextAuth = nextState.auth;

    const tokenChanged = prevAuth?.accessToken !== nextAuth?.accessToken;
    const orgChanged = prevAuth?.organizationId !== nextAuth?.organizationId;
    const roleChanged = prevAuth?.role !== nextAuth?.role;

    if (tokenChanged || orgChanged || roleChanged) {
      api.dispatch(pulseApi.util.resetApiState());
    }
  }

  return result;
};

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    upload: uploadSlice.reducer,
    [pulseApi.reducerPath]: pulseApi.reducer,
  },
  middleware: (gDM) => gDM().concat(pulseApi.middleware, authChangeResetMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
