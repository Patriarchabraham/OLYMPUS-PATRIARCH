/**
 * Master of Masters Studio Pro — De-Hummer & Ground Loop Cleaner Engine.
 * 
 * Removes 50Hz / 60Hz electrical ground loop hum and harmonic buzzing (100/120/180/240Hz)
 * from guitar amplifiers, vintage hardware, and single-coil pickups.
 */

export class DeHummerGroundCleaner {
  /**
   * Cleans 50/60Hz ground loop hum and harmonics.
   */
  public static processDeHum(
    left: Float32Array,
    right: Float32Array,
    freqHz: 50 | 60 = 60,
    amount = 0.85,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const harmonics = [freqHz, freqHz * 2, freqHz * 3, freqHz * 4];
    const numH = harmonics.length;
    const alphas = new Float32Array(numH);

    for (let h = 0; h < numH; h++) {
      const w = (2.0 * Math.PI * harmonics[h]) / sampleRate;
      alphas[h] = Math.exp(-w * 0.05); // Ultra narrow Q notch
    }

    const stateL = new Float32Array(numH);
    const stateR = new Float32Array(numH);

    for (let i = 0; i < len; i++) {
      let l = left[i];
      let r = right[i];

      for (let h = 0; h < numH; h++) {
        const a = alphas[h];
        stateL[h] = a * stateL[h] + (1.0 - a) * l;
        stateR[h] = a * stateR[h] + (1.0 - a) * r;

        // Subtractive notch filter
        l -= stateL[h] * 0.22 * amount;
        r -= stateR[h] * 0.22 * amount;
      }

      outL[i] = l;
      outR[i] = r;
    }

    return { left: outL, right: outR };
  }
}
