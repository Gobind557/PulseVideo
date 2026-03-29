import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';
import type { PresignedUploadInstructions, StorageProvider } from './storage.types.js';
import { NotFoundError } from '../../shared/errors.js';

function orgPrefix(organizationId: string): string {
  return path.join('orgs', organizationId);
}

export class LocalStorageProvider implements StorageProvider {
  constructor(
    private readonly env: Env,
    private readonly rootAbs: string
  ) {}

  resolveSafe(organizationId: string, storagePath: string): string {
    const base = path.resolve(this.rootAbs, orgPrefix(organizationId));
    const target = path.resolve(base, storagePath);
    if (!target.startsWith(base)) {
      throw new Error('Invalid storage path');
    }
    return target;
  }

  getLocalAbsolutePath(organizationId: string, storagePath: string): string {
    return this.resolveSafe(organizationId, storagePath);
  }

  async saveBuffer(organizationId: string, relativePath: string, data: Buffer): Promise<string> {
    const full = this.resolveSafe(organizationId, relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return relativePath;
  }

  async openReadStream(
    organizationId: string,
    storagePath: string
  ): Promise<NodeJS.ReadableStream> {
    const full = this.resolveSafe(organizationId, storagePath);
    if (!fsSync.existsSync(full)) {
      throw new NotFoundError('Video file not found');
    }
    return fsSync.createReadStream(full);
  }

  async stat(organizationId: string, storagePath: string): Promise<{ size: number }> {
    const full = this.resolveSafe(organizationId, storagePath);
    try {
      const s = await fs.stat(full);
      return { size: s.size };
    } catch {
      throw new NotFoundError('Video file not found');
    }
  }

  async readRange(
    organizationId: string,
    storagePath: string,
    start: number,
    end: number
  ): Promise<{ stream: NodeJS.ReadableStream; total: number }> {
    const full = this.resolveSafe(organizationId, storagePath);
    const s = await fs.stat(full);
    const total = s.size;
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(end, total - 1);
    if (safeStart >= total || safeStart > safeEnd) {
      throw new NotFoundError('Range not satisfiable');
    }
    const stream = fsSync.createReadStream(full, { start: safeStart, end: safeEnd });
    return { stream, total };
  }

  /**
   * Local "presigned" flow: we return a URL to our own authenticated upload endpoint;
   * the client still sends the real JWT; upload token in header binds the session.
   * This mirrors S3's capability split without exposing raw disk paths.
   */
  async presignUpload(
    organizationId: string,
    videoId: string,
    storageKey: string,
    _contentType: string,
    _expiresInSec: number
  ): Promise<PresignedUploadInstructions> {
    void organizationId;
    void storageKey;
    const url = `${this.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/videos/presigned-blob/${videoId}`;
    return {
      method: 'POST',
      url,
      headers: {},
      storageKey,
    };
  }
}

/** Generate a stable relative path for a new object. */
export function makeVideoStorageKey(videoId: string, originalName: string): string {
  const ext = path.extname(originalName) || '.bin';
  const safe = createHash('sha256').update(originalName + randomUUID()).digest('hex').slice(0, 12);
  return path.join('videos', videoId, `${safe}${ext}`).replace(/\\/g, '/');
}
