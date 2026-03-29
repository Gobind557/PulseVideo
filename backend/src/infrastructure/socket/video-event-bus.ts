import type { Redis } from 'ioredis';

/** Cross-process fan-out: worker publishes; API Socket.io server forwards to rooms. */
export const VIDEO_EVENT_CHANNEL = 'pulse:video-events';

export type VideoSocketEvent =
  | {
      type: 'processing_progress';
      videoId: string;
      organizationId: string;
      progress: number;
    }
  | {
      type: 'processing_completed';
      videoId: string;
      organizationId: string;
    }
  | {
      type: 'processing_failed';
      videoId: string;
      organizationId: string;
      error: string;
    };

export async function publishVideoEvent(
  publisher: Redis,
  evt: VideoSocketEvent
): Promise<number> {
  return publisher.publish(VIDEO_EVENT_CHANNEL, JSON.stringify(evt));
}
