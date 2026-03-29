/**
 * Storage abstraction: local disk for MVP, S3-compatible for production presigned flows.
 * Callers work in org-scoped keys; providers enforce path prefixes where needed.
 */
export type PresignedUploadInstructions = {
  method: 'PUT' | 'POST';
  url: string;
  /** Extra fields for POST policy uploads (S3). */
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  /** Storage key relative to bucket / org prefix — returned on complete-upload for S3. */
  storageKey: string;
};

export interface StorageProvider {
  /** Save buffer to org-scoped path; returns storage key/path stored on Video.storagePath */
  saveBuffer(organizationId: string, relativePath: string, data: Buffer): Promise<string>;

  /** Open read stream for Range requests (local); S3 may use getObject range in advanced setups. */
  openReadStream(organizationId: string, storagePath: string): Promise<NodeJS.ReadableStream>;

  stat(organizationId: string, storagePath: string): Promise<{ size: number }>;

  /** Inclusive byte range [start, end] per HTTP Range common usage. */
  readRange(
    organizationId: string,
    storagePath: string,
    start: number,
    end: number
  ): Promise<{ stream: NodeJS.ReadableStream; total: number }>;

  presignUpload(
    organizationId: string,
    videoId: string,
    storageKey: string,
    contentType: string,
    expiresInSec: number
  ): Promise<PresignedUploadInstructions>;

  /** After client uploads to S3, server may HEAD-verify (optional). */
  assertExists?(organizationId: string, storageKey: string): Promise<void>;

  /** Worker-local filesystem path (local driver only). */
  getLocalAbsolutePath?(organizationId: string, storagePath: string): string;
}
