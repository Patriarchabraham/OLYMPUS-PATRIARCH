/**
 * Master of Masters Studio Pro — Studio Room & Tape Bleed Glue Matrix.
 * 
 * Simulates physical acoustic room leakage (-54dB to -48dB) between drum kit,
 * bass cab, guitar stacks, and vocal mics inside the live recording room
 * (Compass Point Studios / Abbey Road Studio 2), fusing stems into an organic album sound.
 */

export class StudioBleedGlueMatrixEngine {
  /**
   * Fuses stereo stems with organic physical room acoustic leakage.
   */
  public static processBleedGlue(
    left: Float32Array,
    right: Float32Array,
    bleedAmountDb = -52.0,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const bleedGain = Math.pow(10, bleedAmountDb / 20.0);

    // Early reflection short delay (12ms room wall bounce)
    const delaySamples = Math.floor(sampleRate * 0.012);
    const delBufL = new Float32Array(delaySamples);
    const delBufR = new Float32Array(delaySamples);
    let ptr = 0;

    const alphaDamp = Math.exp((-2.0 * Math.PI * 4500.0) / sampleRate);
    let dampL = 0, dampR = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      const readL = delBufL[ptr];
      const readR = delBufR[ptr];

      // Air absorption damping on reflections
      dampL = alphaDamp * dampL + (1.0 - alphaDamp) * readR; // Cross-reflection L <- R
      dampR = alphaDamp * dampR + (1.0 - alphaDamp) * readL; // Cross-reflection R <- L

      delBufL[ptr] = inL;
      delBufR[ptr] = inR;
      ptr = (ptr + 1) % delaySamples;

      outL[i] = inL + dampL * bleedGain;
      outR[i] = inR + dampR * bleedGain;
    }

    return { left: outL, right: outR };
  }
}
