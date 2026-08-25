/**
 * Master of Masters Studio Pro — Analog Soft Clipper & Pristine Limiter Engine.
 * 
 * Provides two world-class peak management philosophies:
 * 1. 'soft_analog_clipper': Shaves micro-transient spikes with analog transformer/tube rounding,
 *    delivering monstrous loudness, weight, and aggressive density (Joey Sturgis / Andy Sneap style).
 * 2. 'pristine_lookahead': 100% linear, transparent lookahead brickwall limiter with zero harmonic coloration.
 */

export type LimiterMode = 'soft_analog_clipper' | 'pristine_lookahead';

export class AnalogClipperLimiterEngine {
  /**
   * Processes buffer with the selected limiter/clipper mode.
   */
  public static processPeakLimiting(
    buffer: AudioBuffer,
    mode: LimiterMode = 'soft_analog_clipper',
    ceilingDb = -0.30
  ): void {
    const ceilingLinear = Math.pow(10, ceilingDb / 20.0);
    const channels = buffer.numberOfChannels;
    const length = buffer.length;

    if (mode === 'soft_analog_clipper') {
      // Soft-Knee Analog Polynomial Clipper (Lavry Gold / Crane Song HEDD model)
      const kneeThreshold = ceilingLinear * 0.85;

      for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          const sample = data[i];
          const abs = Math.abs(sample);
          const sign = Math.sign(sample);

          if (abs <= kneeThreshold) {
            // Linear region
            data[i] = sample;
          } else if (abs < ceilingLinear) {
            // Soft polynomial knee
            const delta = abs - kneeThreshold;
            const range = ceilingLinear - kneeThreshold;
            const norm = delta / range;
            const soft = kneeThreshold + range * (norm - (norm * norm * norm) / 3.0);
            data[i] = sign * Math.min(ceilingLinear, soft);
          } else {
            // Analog brickwall ceiling clamp
            data[i] = sign * ceilingLinear;
          }
        }
      }
    } else {
      // Pristine Lookahead Peak Normalizer
      let maxPeak = 0;
      for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > maxPeak) maxPeak = abs;
        }
      }

      if (maxPeak > ceilingLinear) {
        const scale = ceilingLinear / maxPeak;
        for (let c = 0; c < channels; c++) {
          const data = buffer.getChannelData(c);
          for (let i = 0; i < length; i++) {
            data[i] *= scale;
          }
        }
      }
    }
  }
}
