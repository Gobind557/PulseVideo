import { ensureUploadDir } from '../bootstrap/ensureUploadDir.js';
import type { Env } from '../config/env.js';
import { connectDb } from '../infrastructure/db/connect.js';
import { createRedisConnection } from '../infrastructure/queue/redis.connection.js';
import { createVideoProcessingQueue } from '../infrastructure/queue/video-processing.queue.js';
import { getStorageProvider } from '../infrastructure/storage/get-storage-provider.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { OrgService } from '../modules/orgs/org.service.js';
import { VideoService } from '../modules/videos/video.service.js';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { ProcessVideoPayload } from '../infrastructure/queue/video-processing.queue.js';
import type { StorageProvider } from '../infrastructure/storage/storage.types.js';

/**
 * Composition root: wires infrastructure + domain services for HTTP and workers.
 * Keeps `createApp` free of business singleton construction.
 */
export type AppContainer = {
  env: Env;
  uploadRootAbs: string;
  redis: Redis;
  storage: StorageProvider;
  videoQueue: Queue<ProcessVideoPayload>;
  orgService: OrgService;
  authService: AuthService;
  videoService: VideoService;
};

export async function createAppContainer(env: Env): Promise<AppContainer> {
  await connectDb(env);
  const uploadRootAbs = ensureUploadDir(env);
  const storage = getStorageProvider(env, uploadRootAbs);
  const redis = createRedisConnection(env);
  const videoQueue = createVideoProcessingQueue(redis);
  const orgService = new OrgService();
  const authService = new AuthService(env, orgService);
  const videoService = new VideoService(storage, videoQueue);

  return {
    env,
    uploadRootAbs,
    redis,
    storage,
    videoQueue,
    orgService,
    authService,
    videoService,
  };
}
