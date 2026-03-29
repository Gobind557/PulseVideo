import { Redis } from 'ioredis';
import type { Env } from '../../config/env.js';

/**
 * BullMQ recommends maxRetriesPerRequest: null on the shared Redis connection.
 */
export function createRedisConnection(env: Env): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
