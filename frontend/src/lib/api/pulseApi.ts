import { createApi } from '@reduxjs/toolkit/query/react';
import type { VideoDto } from '@/types/video';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';

export type LoginBody = {
  email: string;
  password: string;
  organizationId: string;
};

export type RegisterBody = {
  email: string;
  password: string;
  organizationName: string;
};

export type PresignedUploadResponse = {
  videoId: string;
  uploadToken: string;
  method: 'PUT' | 'POST';
  url: string;
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  storageKey: string;
};

/**
 * RTK Query is the only HTTP client for server state;
 * tag invalidation keeps the dashboard and detail view coherent after mutations.
 */
export const pulseApi = createApi({
  reducerPath: 'pulseApi',
  baseQuery: createBaseQueryWithReauth(),
  tagTypes: ['Video'],
  endpoints: (build) => ({
    login: build.mutation({
      query: (body: LoginBody) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
    }),
    register: build.mutation({
      query: (body: RegisterBody) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
    }),
    logout: build.mutation({
      query: (refreshToken: string) => ({
        url: '/auth/logout',
        method: 'POST',
        body: { refreshToken },
      }),
    }),
    listVideos: build.query<
      VideoDto[],
      { status?: string; minDurationSec?: number; maxDurationSec?: number }
    >({
      query: (params) => ({
        url: '/videos',
        params: {
          ...(params.status ? { status: params.status } : {}),
          ...(params.minDurationSec != null
            ? { minDurationSec: String(params.minDurationSec) }
            : {}),
          ...(params.maxDurationSec != null
            ? { maxDurationSec: String(params.maxDurationSec) }
            : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((v) => ({ type: 'Video' as const, id: v._id })),
              { type: 'Video' as const, id: 'LIST' },
            ]
          : [{ type: 'Video', id: 'LIST' }],
    }),
    getVideo: build.query<VideoDto, string>({
      query: (id) => `/videos/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Video', id }],
    }),
    createVideo: build.mutation<{ id: string }, { originalFilename?: string }>({
      query: (body) => ({
        url: '/videos',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Video', id: 'LIST' }],
    }),
    requestPresignedUpload: build.mutation<
      PresignedUploadResponse,
      { originalFilename: string; contentType?: string }
    >({
      query: (body) => ({
        url: '/videos/presigned-upload',
        method: 'POST',
        body: {
          originalFilename: body.originalFilename,
          contentType: body.contentType ?? 'video/mp4',
        },
      }),
      invalidatesTags: [{ type: 'Video', id: 'LIST' }],
    }),
    completePresignedUpload: build.mutation<
      void,
      { videoId: string; storageKey: string }
    >({
      query: (body) => ({
        url: '/videos/complete-upload',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Video', id: arg.videoId },
        { type: 'Video', id: 'LIST' },
      ],
    }),
    uploadVideoMulter: build.mutation<
      { videoId: string; storageKey: string },
      { videoId: string; file: File; signal?: AbortSignal }
    >({
      query: ({ videoId, file, signal }) => {
        const form = new FormData();
        form.append('file', file);
        return {
          url: `/videos/${videoId}/upload`,
          method: 'POST',
          body: form,
          signal,
        };
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Video', id: arg.videoId },
        { type: 'Video', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useListVideosQuery,
  useGetVideoQuery,
  useCreateVideoMutation,
  useRequestPresignedUploadMutation,
  useCompletePresignedUploadMutation,
  useUploadVideoMulterMutation,
} = pulseApi;
