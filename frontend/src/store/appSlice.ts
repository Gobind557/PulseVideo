import { createSlice } from '@reduxjs/toolkit';

type AppState = {
  appName: string;
};

const initialState: AppState = {
  appName: 'Pulse Video',
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {},
});
