import path from 'node:path';
import type { Env } from '../../config/env.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';
import type { StorageProvider } from './storage.types.js';

export function getStorageProvider(env: Env, uploadRootAbs: string): StorageProvider {
  if (env.STORAGE_DRIVER === 's3' && env.S3_BUCKET && env.AWS_REGION) {
    return new S3StorageProvider(env);
  }
  return new LocalStorageProvider(env, uploadRootAbs);
}

export function resolveUploadRootAbs(env: Env): string {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}
