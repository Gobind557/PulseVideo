import { createApi } from '@reduxjs/toolkit/query/react';
import type { VideoDto } from '@/types/video';
import type { OrgMemberDto, VideoAssigneeDto } from '@/types/membership';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import type { MembershipRole } from '@/types/video';

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

export type RegisterInviteBody = {
  email: string;
  password: string;
  inviteToken: string;
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

export type CreateOrgInviteBody = {
  orgId: string;
  role: MembershipRole;
  email?: string;
};

export type CreateOrgInviteResponse = {
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string;
  organizationId: string;
  role: MembershipRole;
  email?: string;
};

/**
 * RTK Query is the only HTTP client for server state;
 * tag invalidation keeps the dashboard and detail view coherent after mutations.
 */
export const pulseApi = createApi({
  reducerPath: 'pulseApi',
  baseQuery: createBaseQueryWithReauth(),
  tagTypes: ['Video', 'Membership'],
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
    registerInvite: build.mutation({
      query: (body: RegisterInviteBody) => ({
        url: '/auth/register-invite',
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

    retryVideo: build.mutation<void, { videoId: string }>({
      query: ({ videoId }) => ({
        url: `/videos/${videoId}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Video', id: arg.videoId },
        { type: 'Video', id: 'LIST' },
      ],
    }),

    updateVideo: build.mutation<void, { videoId: string; originalFilename?: string }>({
      query: ({ videoId, originalFilename }) => ({
        url: `/videos/${videoId}`,
        method: 'PATCH',
        body: { ...(originalFilename != null ? { originalFilename } : {}) },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Video', id: arg.videoId },
        { type: 'Video', id: 'LIST' },
      ],
    }),

    deleteVideo: build.mutation<void, { videoId: string }>({
      query: ({ videoId }) => ({
        url: `/videos/${videoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: () => [{ type: 'Video', id: 'LIST' }],
    }),

    getVideoAssignees: build.query<VideoAssigneeDto[], { videoId: string }>({
      query: ({ videoId }) => `/videos/${videoId}/assignees`,
      providesTags: (_r, _e, arg) => [{ type: 'Video', id: `ASSIGNEES-${arg.videoId}` }],
    }),
    assignVideoViewer: build.mutation<void, { videoId: string; userId: string }>({
      query: ({ videoId, userId }) => ({
        url: `/videos/${videoId}/assignees`,
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Video', id: `ASSIGNEES-${arg.videoId}` }],
    }),
    unassignVideoViewer: build.mutation<void, { videoId: string; userId: string }>({
      query: ({ videoId, userId }) => ({
        url: `/videos/${videoId}/assignees/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Video', id: `ASSIGNEES-${arg.videoId}` }],
    }),

    getOrgMembers: build.query<
      OrgMemberDto[],
      { orgId: string }
    >({
      query: ({ orgId }) => `/orgs/${orgId}/members`,
      providesTags: (result, _err, arg) =>
        result
          ? [
              { type: 'Membership' as const, id: `LIST-${arg.orgId}` },
              ...result.map((m) => ({
                type: 'Membership' as const,
                id: `MEM-${arg.orgId}-${m.userId}`,
              })),
            ]
          : [{ type: 'Membership', id: `LIST-${arg.orgId}` }],
    }),

    changeMemberRole: build.mutation<
      void,
      { orgId: string; userId: string; role: MembershipRole }
    >({
      query: ({ orgId, userId, role }) => ({
        url: `/orgs/${orgId}/members/${userId}/role`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Membership', id: `LIST-${arg.orgId}` },
        { type: 'Membership', id: `MEM-${arg.orgId}-${arg.userId}` },
      ],
    }),

    removeOrgMember: build.mutation<
      void,
      { orgId: string; userId: string }
    >({
      query: ({ orgId, userId }) => ({
        url: `/orgs/${orgId}/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Membership', id: `LIST-${arg.orgId}` },
        { type: 'Membership', id: `MEM-${arg.orgId}-${arg.userId}` },
      ],
    }),

    createOrgInvite: build.mutation<CreateOrgInviteResponse, CreateOrgInviteBody>({
      query: ({ orgId, role, email }) => ({
        url: `/orgs/${orgId}/invites`,
        method: 'POST',
        body: { role, ...(email ? { email } : {}) },
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRegisterInviteMutation,
  useLogoutMutation,
  useListVideosQuery,
  useGetVideoQuery,
  useCreateVideoMutation,
  useRequestPresignedUploadMutation,
  useCompletePresignedUploadMutation,
  useUploadVideoMulterMutation,
  useRetryVideoMutation,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  useGetVideoAssigneesQuery,
  useAssignVideoViewerMutation,
  useUnassignVideoViewerMutation,
  useGetOrgMembersQuery,
  useChangeMemberRoleMutation,
  useRemoveOrgMemberMutation,
  useCreateOrgInviteMutation,
} = pulseApi;
