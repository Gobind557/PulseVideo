import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const VIDEO_PROCESSING_QUEUE = 'video-processing';
export const PROCESS_VIDEO_JOB = 'process-video';

export type ProcessVideoPayload = {
  videoId: string;
  organizationId: string;
  /**
   * Idempotency: worker refuses to start if video status is not pending/processing mismatch,
   * and skips duplicate terminal states.
   */
  dedupeKey: string;
};

export function createVideoProcessingQueue(connection: Redis): Queue<ProcessVideoPayload> {
  return new Queue<ProcessVideoPayload>(VIDEO_PROCESSING_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 500 },
      /** Keep failed jobs for dead-letter inspection / replay tooling. */
      removeOnFail: false,
    },
  });
}
