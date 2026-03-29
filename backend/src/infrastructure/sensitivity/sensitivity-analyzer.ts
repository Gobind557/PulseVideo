import type { SafetyStatus } from '../db/models/video.model.js';

export type SensitivityResult = {
  safetyStatus: SafetyStatus;
  notes?: string;
};

/**
 * Pluggable sensitivity / moderation hook (vendor SDKs, internal models, rules).
 */
export interface SensitivityAnalyzer {
  analyze(metadata: { durationSec?: number; width?: number; height?: number }): Promise<SensitivityResult>;
}

export class MockSensitivityAnalyzer implements SensitivityAnalyzer {
  async analyze(metadata: { durationSec?: number }): Promise<SensitivityResult> {
    if (metadata.durationSec != null && metadata.durationSec > 3600) {
      return { safetyStatus: 'pending_review', notes: 'long_duration' };
    }
    return { safetyStatus: 'safe' };
  }
}
