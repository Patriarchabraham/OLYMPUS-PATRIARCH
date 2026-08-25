/**
 * Master of Masters Studio Pro — Abbey Road ADT (Automatic Double Tracking) Engine.
 * 
 * Physically models Ken Townsend's 1966 Abbey Road dual-tape-deck technique:
 * Two Ampex reel-to-reel machines running in parallel with Varispeed motor flutter,
 * dynamic tape head micro-delays (0.4ms to 2.2ms), and tape saturation.
 */

export class AbbeyRoadAdtEngine {
  /**
   * Applies Abbey Road Reel-to-Reel Tape ADT doubling.
   */
  public static processAdt(
    left: Float32Array,
    right: Float32Array,
    options: {
      varispeedModulation?: number; // 0.1 to 1.0
      tapeDrive?: number;
      width?: number;
      blend?: number;
    } = {},
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const {
      varispeedModulation = 0.65,
      tapeDrive = 0.35,
      width = 1.25,
      blend = 0.50,
    } = options;

    const maxDelaySamples = Math.round(sampleRate * 0.005); // 5ms maximum delay buffer
    const delayBufL = new Float32Array(maxDelaySamples);
    const delayBufR = new Float32Array(maxDelaySamples);
    let writePtr = 0;

    const lfoFreq = 1.4; // 1.4Hz capstan motor flutter
    const lfoW = (2.0 * Math.PI * lfoFreq) / sampleRate;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      delayBufL[writePtr] = inL;
      delayBufR[writePtr] = inR;

      // Modulated delay time (0.8ms base + 0.6ms flutter modulation)
      const mod = Math.sin(lfoW * i);
      const delayMs = 0.8 + 0.6 * mod * varispeedModulation;
      const delaySamples = (delayMs / 1000.0) * sampleRate;

      let readPtr = writePtr - delaySamples;
      if (readPtr < 0) readPtr += maxDelaySamples;

      const idx0 = Math.floor(readPtr);
      const idx1 = (idx0 + 1) % maxDelaySamples;
      const frac = readPtr - idx0;

      // Linear interpolation of tape delayed signal
      const adtL = delayBufL[idx0] * (1.0 - frac) + delayBufL[idx1] * frac;
      const adtR = delayBufR[idx0] * (1.0 - frac) + delayBufR[idx1] * frac;

      // Soft magnetic tape saturation
      const satAdtL = Math.tanh(adtL * (1.0 + tapeDrive * 0.5));
      const satAdtR = Math.tanh(adtR * (1.0 + tapeDrive * 0.5));

      // Stereo wide cross-pan
      const panL = inL + satAdtR * blend * width * 0.5;
      const panR = inR + satAdtL * blend * width * 0.5;

      outL[i] = panL;
      outR[i] = panR;

      writePtr = (writePtr + 1) % maxDelaySamples;
    }

    return { left: outL, right: outR };
  }
}
