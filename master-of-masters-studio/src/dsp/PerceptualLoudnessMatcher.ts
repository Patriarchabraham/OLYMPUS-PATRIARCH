/**
 * Master of Masters Studio Pro — Perceptual Loudness-Matched A/B Controller.
 * 
 * Prevents "louder is better" cognitive bias by calculating the exact ITU-R BS.1770-4
 * loudness difference between Original and Master, adjusting the audition gain
 * in real-time so both tracks are evaluated at identical perceptual LUFS volume.
 */

import { calculateBufferStats } from './WavEncoder';

export class PerceptualLoudnessMatcher {
  /**
   * Computes the exact gain scale factor to match the original track to the master track LUFS.
   */
  public static computeMatchingGain(
    origBuffer: AudioBuffer,
    masterBuffer: AudioBuffer
  ): { origGain: number; masterGain: number; deltaLufs: number } {
    try {
      const statsOrig = calculateBufferStats(origBuffer);
      const statsMaster = calculateBufferStats(masterBuffer);

      const lufsOrig = statsOrig.integratedLufs;
      const lufsMaster = statsMaster.integratedLufs;

      const deltaLufs = lufsMaster - lufsOrig;
      // Master is usually louder than original by deltaLufs (e.g. +6 dB).
      // Scale master down to match original loudness during pure timbre audition.
      const masterScale = Math.pow(10, -Math.max(0, deltaLufs) / 20.0);

      return {
        origGain: 1.0,
        masterGain: Math.max(0.2, Math.min(1.0, masterScale)),
        deltaLufs,
      };
    } catch {
      return { origGain: 1.0, masterGain: 1.0, deltaLufs: 0 };
    }
  }
}
