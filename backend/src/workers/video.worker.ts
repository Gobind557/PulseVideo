import path from 'node:path';
import { Worker } from 'bullmq';
import { ensureUploadDir } from '../bootstrap/ensureUploadDir.js';
import { loadEnvConfig } from '../config/env.js';
import { connectDb } from '../infrastructure/db/connect.js';
import { VideoModel, type VideoLean } from '../infrastructure/db/models/video.model.js';
import { FfmpegService } from '../infrastructure/ffmpeg/ffmpeg.service.js';
import { createRedisConnection } from '../infrastructure/queue/redis.connection.js';
import {
  PROCESS_VIDEO_JOB,
  VIDEO_PROCESSING_QUEUE,
  type ProcessVideoPayload,
} from '../infrastructure/queue/video-processing.queue.js';
import { getStorageProvider } from '../infrastructure/storage/get-storage-provider.js';
import { MockSensitivityAnalyzer } from '../infrastructure/sensitivity/sensitivity-analyzer.js';
import { publishVideoEvent } from '../infrastructure/socket/video-event-bus.js';

/**
 * Separate Node process from the API: BullMQ workers should scale horizontally
 * without coupling to the HTTP server's lifecycle.
 */
async function main() {
  const env = loadEnvConfig();
  await connectDb(env);
  const redis = createRedisConnection(env);
  const uploadRootAbs = ensureUploadDir(env);
  const storage = getStorageProvider(env, uploadRootAbs);
  const samplesDir = path.join(uploadRootAbs, '_ffmpeg_samples');
  const ffmpeg = new FfmpegService(samplesDir);
  const sensitivity = new MockSensitivityAnalyzer();

  new Worker<ProcessVideoPayload>(
    VIDEO_PROCESSING_QUEUE,
    async (job) => {
      if (job.name !== PROCESS_VIDEO_JOB) {
        return;
      }
      const { videoId, organizationId } = job.data;
      const video = await VideoModel.findOne({ _id: videoId, organizationId }).lean<VideoLean | null>();
      if (!video?.storagePath) {
        return;
      }
      if (video.status === 'completed') {
        return;
      }

      await publishVideoEvent(redis, {
        type: 'processing_progress',
        videoId,
        organizationId,
        progress: 5,
      });

      await VideoModel.updateOne(
        { _id: videoId, organizationId, status: { $in: ['pending', 'processing'] } },
        { $set: { status: 'processing', processingError: null } }
      );

      try {
        await job.updateProgress(25);
        await publishVideoEvent(redis, {
          type: 'processing_progress',
          videoId,
          organizationId,
          progress: 25,
        });

        const filePath =
          storage.getLocalAbsolutePath?.(organizationId, video.storagePath) ?? '';

        const meta = await ffmpeg.probeAndSample(filePath);
        const sens = await sensitivity.analyze(meta);

        await VideoModel.updateOne(
          { _id: videoId, organizationId },
          {
            $set: {
              status: 'completed',
              metadata: { ...(video.metadata as Record<string, unknown>), ...meta },
              safetyStatus: sens.safetyStatus,
            },
          }
        );

        await publishVideoEvent(redis, {
          type: 'processing_completed',
          videoId,
          organizationId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'processing_failed';
        await VideoModel.updateOne(
          { _id: videoId, organizationId },
          { $set: { status: 'failed', processingError: message } }
        );
        await publishVideoEvent(redis, {
          type: 'processing_failed',
          videoId,
          organizationId,
          error: message,
        });
        throw err;
      }
    },
    { connection: redis, concurrency: 2 }
  );

  console.log('Video worker running');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
