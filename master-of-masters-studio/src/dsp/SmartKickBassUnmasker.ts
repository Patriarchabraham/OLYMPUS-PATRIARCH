/**
 * Master of Masters Studio Pro — Smart Kick & Bass Spectral Unmasker.
 * 
 * Dynamically sculpts sub-second room in the 50Hz–90Hz bass range whenever the kick drum
 * transient strikes, achieving massive punch, pristine clarity, and zero mud.
 */

export class SmartKickBassUnmasker {
  /**
   * Unmasks kick transient from low-end bass buildup.
   */
  public static processUnmask(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    duckingAmount = 0.50,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outL = new Float32Array(length);
    const outR = new Float32Array(length);

    if (duckingAmount <= 0.01) {
      outL.set(inputLeft);
      outR.set(inputRight);
      return { left: outL, right: outR };
    }

    const amount = Math.min(1.0, Math.max(0.1, duckingAmount));

    // Kick fundamental detector (55Hz - 85Hz)
    const fKick = 65.0;
    const alphaKick = Math.exp((-2.0 * Math.PI * fKick) / sampleRate);
    const alphaAttack = Math.exp((-2.0 * Math.PI * 150.0) / sampleRate);
    const alphaRelease = Math.exp((-2.0 * Math.PI * 18.0) / sampleRate);

    let lpKickL = 0, lpKickR = 0;
    let kickEnv = 0;
    let prevKick = 0;

    for (let i = 0; i < length; i++) {
      const l = inputLeft[i];
      const r = inputRight[i];

      // Low-pass extraction of sub-kick
      lpKickL = alphaKick * lpKickL + (1.0 - alphaKick) * l;
      lpKickR = alphaKick * lpKickR + (1.0 - alphaKick) * r;
      const subEnergy = Math.abs(lpKickL + lpKickR) * 0.5;

      // Transient attack delta detection
      const delta = Math.max(0, subEnergy - prevKick);
      prevKick = subEnergy;

      if (delta > kickEnv) {
        kickEnv = alphaAttack * kickEnv + (1.0 - alphaAttack) * delta * 2.5;
      } else {
        kickEnv *= alphaRelease;
      }

      // Dynamic ducking coefficient for sub-bass center
      const duck = Math.min(0.65, kickEnv * 1.8 * amount);
      const subClearL = lpKickL * (1.0 - duck * 0.35);
      const subClearR = lpKickR * (1.0 - duck * 0.35);

      const highL = l - lpKickL;
      const highR = r - lpKickR;

      outL[i] = highL + subClearL;
      outR[i] = highR + subClearR;
    }

    return { left: outL, right: outR };
  }
}
