import { configureStore } from '@reduxjs/toolkit';
import { pulseApi } from '@/lib/api/pulseApi';
import { authSlice } from '@/features/auth/authSlice';
import { uploadSlice } from '@/features/upload/uploadSlice';
import { appSlice } from './appSlice';

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    upload: uploadSlice.reducer,
    [pulseApi.reducerPath]: pulseApi.reducer,
  },
  middleware: (gDM) => gDM().concat(pulseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
