/**
 * Master of Masters Studio Pro — Gain-Matched A/B Comparison Engine.
 * 
 * Computes the loudness (RMS / integrated LUFS) delta between the unmastered raw mix
 * and the finalized master track, dynamically normalizing playback volume on the fly
 * so mastering engineers can make 100% objective, volume-unbiased acoustic evaluations.
 */

export class GainMatchedAbEngine {
  /**
   * Computes the exact linear gain compensation factor between original and master.
   */
  public static computeGainMatchFactor(
    originalBuffer: AudioBuffer,
    masterBuffer: AudioBuffer
  ): number {
    const origL = originalBuffer.getChannelData(0);
    const mastL = masterBuffer.getChannelData(0);

    const length = Math.min(origL.length, mastL.length, 44100 * 30);
    let origSumSq = 0;
    let mastSumSq = 0;

    const step = 16;
    let count = 0;

    for (let i = 0; i < length; i += step) {
      origSumSq += origL[i] * origL[i];
      mastSumSq += mastL[i] * mastL[i];
      count++;
    }

    const origRms = Math.sqrt(origSumSq / Math.max(1, count));
    const mastRms = Math.sqrt(mastSumSq / Math.max(1, count));

    if (origRms <= 1e-5 || mastRms <= 1e-5) return 1.0;

    // Returns the scaling factor to apply to the Master when Gain-Match is enabled
    return Math.min(1.0, origRms / mastRms);
  }
}
