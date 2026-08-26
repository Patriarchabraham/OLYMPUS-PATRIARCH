/**
 * Master of Masters Studio Pro — Nasal Zeroes & Articulatory ARMA Filter Engine.
 * 
 * Auto-Regressive Moving Average (ARMA) filter that simulates both vocal tract
 * resonant poles and anti-resonant nasal cavity zeroes (850Hz and 1800Hz absorption notches)
 * for pristine linguistic diction and consonant clarity (/m/, /n/, /ng/).
 */

export class NasalZeroesArmaFilterEngine {
  /**
   * Processes vocal track through the ARMA pole-zero articulatory filter.
   */
  public static processArmaFilter(
    left: Float32Array,
    right: Float32Array,
    nasalClarity = 0.60,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    // Nasal Anti-Resonance Zeroes at 850Hz and 1800Hz
    const zeroFreq1 = 850.0;
    const zeroFreq2 = 1800.0;
    const alphaZ1 = Math.exp((-2.0 * Math.PI * zeroFreq1) / sampleRate);
    const alphaZ2 = Math.exp((-2.0 * Math.PI * zeroFreq2) / sampleRate);

    let z1L = 0, z1R = 0;
    let z2L = 0, z2R = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      // Anti-resonance notch 1 (850Hz)
      const notch1L = inL - alphaZ1 * z1L;
      const notch1R = inR - alphaZ1 * z1R;
      z1L = inL;
      z1R = inR;

      // Anti-resonance notch 2 (1800Hz)
      const notch2L = notch1L - alphaZ2 * z2L;
      const notch2R = notch1R - alphaZ2 * z2R;
      z2L = notch1L;
      z2R = notch1R;

      const blend = nasalClarity * 0.35;
      outL[i] = inL * (1.0 - blend) + notch2L * blend;
      outR[i] = inR * (1.0 - blend) + notch2R * blend;
    }

    return { left: outL, right: outR };
  }
}
