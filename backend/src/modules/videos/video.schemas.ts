import { z } from 'zod';
import { VIDEO_STATUSES } from '../../infrastructure/db/models/video.model.js';

export const createVideoBodySchema = z.object({
  originalFilename: z.string().min(1).max(500).optional(),
});

export const updateVideoBodySchema = z.object({
  originalFilename: z.string().min(1).max(500).optional(),
});

export const assignVideoViewerBodySchema = z.object({
  userId: z.string().min(1),
});

export const presignedUploadBodySchema = z.object({
  originalFilename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200).default('video/mp4'),
});

export const completeUploadBodySchema = z.object({
  videoId: z.string().min(1),
  storageKey: z.string().min(1),
});

export const listVideosQuerySchema = z.object({
  status: z.enum(VIDEO_STATUSES).optional(),
  minDurationSec: z.coerce.number().optional(),
  maxDurationSec: z.coerce.number().optional(),
});
