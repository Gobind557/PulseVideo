import crypto from 'node:crypto';
import type { Queue } from 'bullmq';
import {
  PROCESS_VIDEO_JOB,
  type ProcessVideoPayload,
} from '../../infrastructure/queue/video-processing.queue.js';
import type { StorageProvider } from '../../infrastructure/storage/storage.types.js';
import { makeVideoStorageKey } from '../../infrastructure/storage/local-storage.provider.js';
import {
  VideoModel,
  type VideoLean,
  type VideoMetadata,
} from '../../infrastructure/db/models/video.model.js';
import { AppError, NotFoundError, RangeNotSatisfiableError } from '../../shared/errors.js';
import { parseByteRange } from '../../shared/http-range.js';

const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * All tenant boundaries: every query includes organizationId from auth context — never from raw client org fields.
 */
export class VideoService {
  constructor(
    private readonly storage: StorageProvider,
    private readonly videoQueue: Queue<ProcessVideoPayload>
  ) {}

  async createPending(organizationId: string, userId: string, originalFilename?: string) {
    const doc = await VideoModel.create({
      organizationId,
      createdBy: userId,
      status: 'pending',
      metadata: originalFilename ? { originalFilename } : {},
    });
    return doc;
  }

  async requestPresignedUpload(
    organizationId: string,
    userId: string,
    originalFilename: string,
    contentType: string
  ) {
    const video = await this.createPending(organizationId, userId, originalFilename);
    const videoId = String(video._id);
    const storageKey = makeVideoStorageKey(videoId, originalFilename);
    const uploadToken = crypto.randomBytes(32).toString('hex');
    const pendingUploadTokenHash = crypto.createHash('sha256').update(uploadToken).digest('hex');
    await VideoModel.updateOne(
      { _id: video._id, organizationId },
      {
        $set: {
          pendingUploadTokenHash,
          pendingUploadExpiresAt: new Date(Date.now() + UPLOAD_TOKEN_TTL_MS),
        },
      }
    );
    const instructions = await this.storage.presignUpload(
      organizationId,
      videoId,
      storageKey,
      contentType,
      3600
    );
    return {
      videoId,
      uploadToken,
      ...instructions,
    };
  }

  async completePresignedUpload(
    organizationId: string,
    userId: string,
    videoId: string,
    storageKey: string
  ) {
    const video = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
    if (!video) {
      throw new NotFoundError('Video not found');
    }
    if (video.createdBy.toString() !== userId) {
      throw new AppError('FORBIDDEN', 'Not the creator of this video', 403);
    }
    if (this.storage.assertExists) {
      await this.storage.assertExists(organizationId, storageKey);
    } else {
      await this.storage.stat(organizationId, storageKey);
    }
    await VideoModel.updateOne(
      { _id: videoId, organizationId },
      {
        $set: {
          storagePath: storageKey,
          pendingUploadTokenHash: null,
          pendingUploadExpiresAt: null,
        },
      }
    );
    await this.enqueueProcessing(videoId, organizationId);
  }

  async saveMulterUpload(
    organizationId: string,
    userId: string,
    videoId: string,
    file: Express.Multer.File
  ) {
    const video = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
    if (!video) {
      throw new NotFoundError('Video not found');
    }
    if (video.createdBy.toString() !== userId) {
      throw new AppError('FORBIDDEN', 'Not the creator of this video', 403);
    }
    const storageKey = makeVideoStorageKey(videoId, file.originalname);
    await this.storage.saveBuffer(organizationId, storageKey, file.buffer);
    const metadata: VideoMetadata = {
      mimeType: file.mimetype,
    };
    await VideoModel.updateOne(
      { _id: videoId, organizationId },
      { $set: { storagePath: storageKey, metadata } }
    );
    await this.enqueueProcessing(videoId, organizationId);
    return { videoId, storageKey };
  }

  async savePresignedBlob(
    organizationId: string,
    userId: string,
    videoId: string,
    uploadToken: string | undefined,
    file: Express.Multer.File
  ) {
    if (!uploadToken) {
      throw new AppError('VALIDATION_ERROR', 'Missing upload token', 400);
    }
    const video = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
    if (!video) {
      throw new NotFoundError('Video not found');
    }
    if (video.createdBy.toString() !== userId) {
      throw new AppError('FORBIDDEN', 'Not the creator of this video', 403);
    }
    if (
      !video.pendingUploadTokenHash ||
      !video.pendingUploadExpiresAt ||
      video.pendingUploadExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('UPLOAD_EXPIRED', 'Upload session expired', 400);
    }
    const hash = crypto.createHash('sha256').update(uploadToken).digest('hex');
    if (hash !== video.pendingUploadTokenHash) {
      throw new AppError('FORBIDDEN', 'Invalid upload token', 403);
    }
    const storageKey = makeVideoStorageKey(videoId, file.originalname);
    await this.storage.saveBuffer(organizationId, storageKey, file.buffer);
    await VideoModel.updateOne(
      { _id: videoId, organizationId },
      {
        $set: {
          storagePath: storageKey,
          pendingUploadTokenHash: null,
          pendingUploadExpiresAt: null,
          metadata: { mimeType: file.mimetype },
        },
      }
    );
    await this.enqueueProcessing(videoId, organizationId);
    return { videoId, storageKey };
  }

  async listForOrg(
    organizationId: string,
    filters: {
      status?: string;
      minDurationSec?: number;
      maxDurationSec?: number;
    }
  ) {
    const q: Record<string, unknown> = { organizationId };
    if (filters.status) {
      q.status = filters.status;
    }
    const docs = await VideoModel.find(q).sort({ createdAt: -1 }).lean();
    return docs.filter((d) => {
      const dur = (d.metadata as VideoMetadata)?.durationSec;
      if (filters.minDurationSec != null && (dur == null || dur < filters.minDurationSec)) {
        return false;
      }
      if (filters.maxDurationSec != null && (dur == null || dur > filters.maxDurationSec)) {
        return false;
      }
      return true;
    });
  }

  async getById(organizationId: string, videoId: string) {
    const doc = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
    if (!doc) {
      throw new NotFoundError('Video not found');
    }
    return doc;
  }

  async getStreamPayload(
    organizationId: string,
    videoId: string,
    rangeHeader: string | undefined
  ) {
    const video = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
    if (!video?.storagePath) {
      throw new NotFoundError('Video not found or not uploaded');
    }
    const { size: total } = await this.storage.stat(organizationId, video.storagePath);
    const mimeType =
      (video.metadata as VideoMetadata)?.mimeType ?? 'application/octet-stream';

    if (!rangeHeader) {
      const { stream } = await this.storage.readRange(
        organizationId,
        video.storagePath,
        0,
        total - 1
      );
      return {
        statusCode: 200 as const,
        stream,
        start: 0,
        end: total - 1,
        total,
        mimeType,
      };
    }

    const parsed = parseByteRange(rangeHeader, total);
    if (parsed === 'unsatisfiable') {
      throw new RangeNotSatisfiableError(total);
    }
    if (parsed === null) {
      throw new RangeNotSatisfiableError(total);
    }

    const { stream } = await this.storage.readRange(
      organizationId,
      video.storagePath,
      parsed.start,
      parsed.end
    );
    return {
      statusCode: 206 as const,
      stream,
      start: parsed.start,
      end: parsed.end,
      total,
      mimeType,
    };
  }

  private async enqueueProcessing(videoId: string, organizationId: string) {
    const dedupeKey = `${organizationId}:${videoId}`;
    const job = await this.videoQueue.add(PROCESS_VIDEO_JOB, {
      videoId,
      organizationId,
      dedupeKey,
    });
    const jobId = job.id ?? dedupeKey;
    await VideoModel.updateOne(
      { _id: videoId, organizationId },
      { $set: { lastJobId: String(jobId), status: 'processing' } }
    );
  }
}
