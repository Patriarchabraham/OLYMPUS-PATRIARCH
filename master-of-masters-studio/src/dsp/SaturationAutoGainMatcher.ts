/**
 * Master of Masters Studio Pro — Saturation Auto-Gain Makeup Matcher.
 * 
 * Computes root-mean-square (RMS) level before and after distortion,
 * automatically applying gain compensation so the perceived listening volume remains constant.
 */

export class SaturationAutoGainMatcher {
  /**
   * Applies auto-gain loudness matching between dry and wet distorted buffers.
   */
  public static matchGain(
    dryBuffer: Float32Array,
    wetBuffer: Float32Array
  ): Float32Array {
    const len = dryBuffer.length;
    const out = new Float32Array(len);

    let dryEnergy = 0;
    let wetEnergy = 0;
    const step = 8;

    for (let i = 0; i < len; i += step) {
      dryEnergy += dryBuffer[i] * dryBuffer[i];
      wetEnergy += wetBuffer[i] * wetBuffer[i];
    }

    const dryRms = Math.sqrt(dryEnergy / (len / step));
    const wetRms = Math.sqrt(wetEnergy / (len / step));

    const gainScale = wetRms > 0.0001 && dryRms > 0.0001 ? Math.min(2.0, Math.max(0.4, dryRms / wetRms)) : 1.0;

    for (let i = 0; i < len; i++) {
      out[i] = wetBuffer[i] * gainScale;
    }

    return out;
  }
}
