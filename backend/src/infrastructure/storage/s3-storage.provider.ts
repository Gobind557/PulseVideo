import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import type { Env } from '../../config/env.js';
import { NotFoundError } from '../../shared/errors.js';
import type { PresignedUploadInstructions, StorageProvider } from './storage.types.js';

function orgPrefix(organizationId: string): string {
  return `orgs/${organizationId}`;
}

/**
 * S3-compatible provider: presigned PUT for uploads; streaming uses GetObject with Range in handler
 * can be extended — for this codebase Local opens file streams; S3 stream path uses getObject stream.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly env: Env) {
    if (!env.S3_BUCKET || !env.AWS_REGION) {
      throw new Error('S3StorageProvider requires S3_BUCKET and AWS_REGION');
    }
    this.client = new S3Client({
      region: env.AWS_REGION,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  private key(organizationId: string, storagePath: string): string {
    return `${orgPrefix(organizationId)}/${storagePath.replace(/^\//, '')}`;
  }

  async saveBuffer(organizationId: string, relativePath: string, data: Buffer): Promise<string> {
    const bucket = this.env.S3_BUCKET!;
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: this.key(organizationId, relativePath),
        Body: data,
      })
    );
    return relativePath;
  }

  async openReadStream(organizationId: string, storagePath: string): Promise<NodeJS.ReadableStream> {
    const bucket = this.env.S3_BUCKET!;
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: this.key(organizationId, storagePath),
      })
    );
    const body = out.Body;
    if (!body || !(body instanceof Readable)) {
      throw new NotFoundError('Video file not found');
    }
    return body;
  }

  async stat(organizationId: string, storagePath: string): Promise<{ size: number }> {
    const bucket = this.env.S3_BUCKET!;
    try {
      const head = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: this.key(organizationId, storagePath),
        })
      );
      const size = head.ContentLength ?? 0;
      return { size };
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
    const bucket = this.env.S3_BUCKET!;
    const Key = this.key(organizationId, storagePath);
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: bucket, Key })
    );
    const total = head.ContentLength ?? 0;
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(end, total - 1);
    if (safeStart >= total || safeStart > safeEnd) {
      throw new NotFoundError('Range not satisfiable');
    }
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key,
        Range: `bytes=${safeStart}-${safeEnd}`,
      })
    );
    const body = out.Body;
    if (!body || !(body instanceof Readable)) {
      throw new NotFoundError('Video file not found');
    }
    return { stream: body, total };
  }

  async presignUpload(
    organizationId: string,
    _videoId: string,
    storageKey: string,
    contentType: string,
    expiresInSec: number
  ): Promise<PresignedUploadInstructions> {
    void _videoId;
    const bucket = this.env.S3_BUCKET!;
    const Key = this.key(organizationId, storageKey);
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: expiresInSec });
    return {
      method: 'PUT',
      url,
      headers: {
        'Content-Type': contentType,
      },
      storageKey,
    };
  }

  async assertExists(organizationId: string, storageKey: string): Promise<void> {
    await this.stat(organizationId, storageKey);
  }
}
