import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type { VideoMetadata } from '../db/models/video.model.js';

export type FfmpegProbeResult = VideoMetadata;

/**
 * FFmpeg integration is mocked here to avoid binary coupling in dev CI.
 * Swap implementation with fluent-ffmpeg or spawn('ffmpeg') in production.
 */
export class FfmpegService {
  constructor(private readonly sampleFramesDirAbs: string) {}

  async probeAndSample(_fileAbsPath: string): Promise<FfmpegProbeResult> {
    await fs.mkdir(this.sampleFramesDirAbs, { recursive: true });
    const frameName = `frame-${randomUUID()}.jpg`;
    const frameRel = path.join('samples', frameName).replace(/\\/g, '/');
    const frameAbs = path.join(this.sampleFramesDirAbs, frameName);
    await fs.writeFile(frameAbs, Buffer.from('mock-frame-bytes'));

    return {
      durationSec: 12.34,
      width: 1280,
      height: 720,
      mimeType: 'video/mp4',
      sampleFramePaths: [frameRel],
    };
  }
}
