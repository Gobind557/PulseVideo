import type { SafetyStatus } from '../db/models/video.model.js';

export type SensitivityResult = {
  safetyStatus: SafetyStatus;
  notes?: string;
};

/**
 * Pluggable sensitivity / moderation hook (vendor SDKs, internal models, rules).
 */
export type SensitivityLevel = 'low' | 'medium' | 'high';

export interface SensitivityAnalyzer {
  analyze(
    metadata: { durationSec?: number; width?: number; height?: number },
    sensitivityLevel?: SensitivityLevel
  ): Promise<SensitivityResult>;
}

export class MockSensitivityAnalyzer implements SensitivityAnalyzer {
  async analyze(
    metadata: { durationSec?: number },
    sensitivityLevel: SensitivityLevel = 'medium'
  ): Promise<SensitivityResult> {
    const thresholdSec =
      sensitivityLevel === 'low' ? 7200 : sensitivityLevel === 'high' ? 1800 : 3600;
    if (metadata.durationSec != null && metadata.durationSec > thresholdSec) {
      return { safetyStatus: 'pending_review', notes: 'long_duration' };
    }
    return { safetyStatus: 'safe' };
  }
}
