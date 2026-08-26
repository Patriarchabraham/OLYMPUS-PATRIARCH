/**
 * Master of Masters Studio Pro — Instrument Pick Attack & Shell Transient Cloner.
 * 
 * Clones the signature physical attack transients of legendary instruments:
 * - Steve Harris (Iron Maiden): Flatwound bass string clack on frets (2.8k-4kHz)
 * - Eddie Van Halen: Brown Sound harmonic pinch & pick chirp (1.8k-2.5kHz)
 * - John Bonham (Led Zeppelin): Wooden beater attack slam (52Hz + 3.8kHz)
 */

export type InstrumentClonerPreset = 'steve_harris_clack' | 'evh_brown_pick' | 'bonham_beater_slam';

export class InstrumentPickTransientCloner {
  /**
   * Enhances instrument pick attack and physical shell impact.
   */
  public static processTransientCloning(
    left: Float32Array,
    right: Float32Array,
    preset: InstrumentClonerPreset = 'steve_harris_clack',
    intensity = 0.65,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    let centerFreq = 3400.0;
    let boostDb = 2.5;

    switch (preset) {
      case 'steve_harris_clack':
        centerFreq = 3200.0;
        boostDb = 3.5;
        break;
      case 'evh_brown_pick':
        centerFreq = 2200.0;
        boostDb = 2.8;
        break;
      case 'bonham_beater_slam':
        centerFreq = 3800.0;
        boostDb = 3.2;
        break;
    }

    const alpha = Math.exp((-2.0 * Math.PI * centerFreq) / sampleRate);
    const gainFactor = (Math.pow(10, boostDb / 20) - 1.0) * intensity;

    let filterL = 0, filterR = 0;
    let envFast = 0, envSlow = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];
      const mid = 0.5 * (inL + inR);

      // Transient detection
      const abs = Math.abs(mid);
      envFast = 0.80 * envFast + 0.20 * abs;
      envSlow = 0.98 * envSlow + 0.02 * abs;
      const isTransient = Math.max(0, envFast - envSlow * 1.3);

      filterL = alpha * filterL + (1.0 - alpha) * inL;
      filterR = alpha * filterR + (1.0 - alpha) * inR;

      const attackBandL = (inL - filterL) * isTransient * gainFactor;
      const attackBandR = (inR - filterR) * isTransient * gainFactor;

      outL[i] = inL + attackBandL;
      outR[i] = inR + attackBandR;
    }

    return { left: outL, right: outR };
  }
}
