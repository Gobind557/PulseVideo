/** Mirrors API JSON for video documents (multi-tenant; org never sent from client). */
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SafetyStatus = 'unknown' | 'pending_review' | 'safe' | 'flagged';

export type VideoMetadata = {
  durationSec?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  sampleFramePaths?: string[];
  originalFilename?: string;
};

export type VideoDto = {
  _id: string;
  organizationId: string;
  createdBy: string;
  status: VideoStatus;
  safetyStatus: SafetyStatus;
  metadata: VideoMetadata;
  storagePath: string;
  processingError: string | null;
  processingProgress?: number | null;
  processingStage?: string;
  lastJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MembershipRole = 'viewer' | 'editor' | 'admin';
