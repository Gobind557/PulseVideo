import type { Redis } from 'ioredis';

/** Cross-process fan-out: worker publishes; API Socket.io server forwards to rooms. */
export const VIDEO_EVENT_CHANNEL = 'pulse:video-events';

export type VideoProcessingStage =
  | 'queued'
  | 'probing'
  | 'sampling'
  | 'analyzing'
  | 'finalizing'
  | 'completed'
  | 'failed';

export type VideoSocketEvent =
  | {
      type: 'processing_progress';
      videoId: string;
      organizationId: string;
      progress: number;
      stage?: VideoProcessingStage;
    }
  | {
      type: 'processing_completed';
      videoId: string;
      organizationId: string;
      stage?: VideoProcessingStage;
    }
  | {
      type: 'processing_failed';
      videoId: string;
      organizationId: string;
      error: string;
      stage?: VideoProcessingStage;
    };

export async function publishVideoEvent(
  publisher: Redis,
  evt: VideoSocketEvent
): Promise<number> {
  return publisher.publish(VIDEO_EVENT_CHANNEL, JSON.stringify(evt));
}
