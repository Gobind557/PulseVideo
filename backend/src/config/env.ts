import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load repo-root .env when running from backend/
loadEnv({ path: path.resolve(process.cwd(), '..', '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(16),
  /** Separate refresh signing secret in production; defaults derived for local dev only. */
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Public API base URL used in presigned upload instructions for local storage (e.g. http://localhost:4000). */
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  /** Public web URL used to build invite links (e.g. http://localhost:5173). */
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  /** Directory for uploaded video files (created at runtime if missing). */
  UPLOAD_DIR: z.string().default('uploads'),
  /** `local` = disk + dev presigned simulation; `s3` = real presigned URLs when bucket is configured. */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnvConfig(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export function getJwtRefreshSecret(env: Env): string {
  return env.JWT_REFRESH_SECRET ?? `${env.JWT_SECRET}:refresh`;
}
