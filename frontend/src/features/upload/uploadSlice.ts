import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** UI-only upload progress; binary work stays in hooks / AbortController (non-serializable). */
type UploadJobStatus = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled';

export type UploadJob = {
  videoId: string;
  progress: number;
  status: UploadJobStatus;
  errorMessage?: string;
};

type UploadState = {
  jobs: Record<string, UploadJob>;
};

const initialState: UploadState = {
  jobs: {},
};

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    uploadInitiated: (
      state,
      action: PayloadAction<{ videoId: string; fileName: string }>
    ) => {
      const { videoId } = action.payload;
      state.jobs[videoId] = {
        videoId,
        progress: 0,
        status: 'uploading',
      };
    },
    uploadProgress: (
      state,
      action: PayloadAction<{ videoId: string; progress: number }>
    ) => {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.progress = action.payload.progress;
      }
    },
    uploadSucceeded: (state, action: PayloadAction<{ videoId: string }>) => {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.status = 'success';
        job.progress = 100;
      }
    },
    uploadFailed: (
      state,
      action: PayloadAction<{ videoId: string; error: string }>
    ) => {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.status = 'error';
        job.errorMessage = action.payload.error;
      }
    },
    uploadCancelled: (state, action: PayloadAction<{ videoId: string }>) => {
      const job = state.jobs[action.payload.videoId];
      if (job) {
        job.status = 'cancelled';
      }
    },
    clearUploadJob: (state, action: PayloadAction<{ videoId: string }>) => {
      delete state.jobs[action.payload.videoId];
    },
  },
});

export const {
  uploadInitiated,
  uploadProgress,
  uploadSucceeded,
  uploadFailed,
  uploadCancelled,
  clearUploadJob,
} = uploadSlice.actions;

export { uploadSlice };
