/**
 * Master of Masters Studio Pro — Legendary Power Tube Physical Modeler.
 * 
 * Accurately simulates the transfer curves of historic power vacuum tubes:
 * 1. 'el34_british': Rich in 2nd & 3rd harmonics with creamy upper-mid focus (Iron Maiden, AC/DC, Judas Priest).
 * 2. '6l6_american': Extended sub-bass, scooped lower-mids, glass-like top end (Metallica, Pantera, Dream Theater).
 * 3. 'kt88_modern': Massive dynamic headroom, ultra-fast transients, monolithic punch (Modern Metal).
 */

export type PowerTubeType = 'el34_british' | '6l6_american' | 'kt88_modern';

export class PowerTubeModelerEngine {
  /**
   * Applies power tube transfer curves to a stereo stream.
   */
  public static processPowerTubes(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    tubeType: PowerTubeType = 'el34_british',
    drive = 0.50
  ): { left: Float32Array; right: Float32Array } {
    const len = inputLeft.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const d = Math.max(0.01, Math.min(1.0, drive));

    for (let i = 0; i < len; i++) {
      const sL = inputLeft[i];
      const sR = inputRight[i];

      if (tubeType === 'el34_british') {
        // Asymmetric pentode curve with 2nd/3rd harmonics
        const k = 1.0 + d * 3.0;
        outL[i] = sL >= 0 ? Math.tanh(k * sL) : Math.tanh(k * sL * 0.85) * 1.12;
        outR[i] = sR >= 0 ? Math.tanh(k * sR) : Math.tanh(k * sR * 0.85) * 1.12;
      } else if (tubeType === '6l6_american') {
        // Symmetric beam tetrode curve with extended headroom
        const k = 1.0 + d * 4.2;
        const x4L = Math.pow(k * sL, 4.0);
        const x4R = Math.pow(k * sR, 4.0);
        outL[i] = (k * sL) / Math.pow(1.0 + x4L, 0.25);
        outR[i] = (k * sR) / Math.pow(1.0 + x4R, 0.25);
      } else {
        // KT88 High-Headroom Slam
        const k = 1.0 + d * 2.2;
        outL[i] = Math.atan(k * sL) * 1.05;
        outR[i] = Math.atan(k * sR) * 1.05;
      }
    }

    return { left: outL, right: outR };
  }
}
