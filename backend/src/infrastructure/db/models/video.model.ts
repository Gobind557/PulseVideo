import mongoose, { Schema } from 'mongoose';

export const VIDEO_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const SAFETY_STATUSES = ['unknown', 'pending_review', 'safe', 'flagged'] as const;
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export type VideoMetadata = {
  durationSec?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  sampleFramePaths?: string[];
};

export type VideoDocument = mongoose.Document &
  mongoose.InferSchemaType<typeof videoSchema> & { _id: mongoose.Types.ObjectId };

const videoSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: VIDEO_STATUSES,
      default: 'pending' satisfies VideoStatus,
      index: true,
    },
    safetyStatus: {
      type: String,
      enum: SAFETY_STATUSES,
      default: 'unknown' satisfies SafetyStatus,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    storagePath: { type: String, default: '' },
    /** Opaque upload token hash for local presigned-style flow; cleared after upload completes. */
    pendingUploadTokenHash: { type: String, default: null },
    pendingUploadExpiresAt: { type: Date, default: null },
    processingError: { type: String, default: null },
    /**
     * Real-time processing progress (0-100). Set by worker and streamed to clients via Socket.io.
     * Null means "unknown / not started".
     */
    processingProgress: { type: Number, default: null, min: 0, max: 100 },
    /**
     * Human-friendly stage for interview-grade transparency.
     * Frontend can render "probing / analyzing / finalizing" alongside percent.
     */
    processingStage: { type: String, default: 'queued' },
    /** BullMQ job id for idempotency / debugging */
    lastJobId: { type: String, default: null },
  },
  { timestamps: true }
);

videoSchema.index({ organizationId: 1, createdAt: -1 });

export const VideoModel = mongoose.models.Video ?? mongoose.model('Video', videoSchema);

export type VideoLean = mongoose.FlattenMaps<
  mongoose.InferSchemaType<typeof videoSchema>
> & { _id: mongoose.Types.ObjectId };
