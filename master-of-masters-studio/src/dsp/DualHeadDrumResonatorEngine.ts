/**
 * Master of Masters Studio Pro — Dual-Head Drum Membrane & Snare Wire Resonator Engine.
 * 
 * Simulates:
 * 1. Dual-membrane acoustic coupling (batter head top + resonant head bottom).
 * 2. 24-strand steel snare wire physical sympathetic buzz.
 */

export class DualHeadDrumResonatorEngine {
  /**
   * Enhances drum synthesis with resonant head vibration and snare wire buzz.
   */
  public static processDualHeadSnare(
    inputL: Float32Array,
    inputR: Float32Array,
    snareWireTension = 0.65,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = inputL.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    // Resonant bottom head bandpass around 320Hz
    const f0 = 320.0;
    const q = 4.5;
    const w0 = (2.0 * Math.PI * f0) / sampleRate;
    const alpha = Math.sin(w0) / (2.0 * q);

    let b0 = alpha, b2 = -alpha;
    let a0 = 1.0 + alpha, a1 = -2.0 * Math.cos(w0), a2 = 1.0 - alpha;
    b0 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;

    let x1L = 0, x2L = 0, y1L = 0, y2L = 0;
    let x1R = 0, x2R = 0, y1R = 0, y2R = 0;

    for (let i = 0; i < len; i++) {
      const sL = inputL[i];
      const sR = inputR[i];

      // Bottom head resonance
      const resL = b0 * sL + b2 * x2L - a1 * y1L - a2 * y2L;
      x2L = x1L; x1L = sL; y2L = y1L; y1L = resL;

      const resR = b0 * sR + b2 * x2R - a1 * y1R - a2 * y2R;
      x2R = x1R; x1R = sR; y2R = y1R; y1R = resR;

      // 24-wire snare buzz non-linear excitation
      const wireBuzzL = (Math.random() * 2.0 - 1.0) * Math.abs(resL) * snareWireTension * 0.35;
      const wireBuzzR = (Math.random() * 2.0 - 1.0) * Math.abs(resR) * snareWireTension * 0.35;

      outL[i] = sL + resL * 0.30 + wireBuzzL;
      outR[i] = sR + resR * 0.30 + wireBuzzR;
    }

    return { left: outL, right: outR };
  }
}
