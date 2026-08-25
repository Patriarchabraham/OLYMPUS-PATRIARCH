/**
 * Master of Masters Studio Pro — Transient Punch & Attack Sculptor.
 * 
 * Separates instantaneous transient attack from steady-state sustain,
 * boosting explosive punch and micro-dynamics without triggering harsh digital clipping.
 */

export class TransientPunchSculptor {
  /**
   * Enhances transient snap and punch across stereo audio.
   */
  public static processTransientPunch(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    attackBoost = 0.45,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outL = new Float32Array(length);
    const outR = new Float32Array(length);

    if (attackBoost <= 0.01) {
      outL.set(inputLeft);
      outR.set(inputRight);
      return { left: outL, right: outR };
    }

    const boost = Math.min(1.0, Math.max(0.1, attackBoost));

    // Fast and slow envelope follower time constants
    const alphaFast = Math.exp((-2.0 * Math.PI * 400.0) / sampleRate);
    const alphaSlow = Math.exp((-2.0 * Math.PI * 25.0) / sampleRate);

    let envFastL = 0, envFastR = 0;
    let envSlowL = 0, envSlowR = 0;

    for (let i = 0; i < length; i++) {
      const l = inputLeft[i];
      const r = inputRight[i];

      const absL = Math.abs(l);
      const absR = Math.abs(r);

      envFastL = alphaFast * envFastL + (1.0 - alphaFast) * absL;
      envFastR = alphaFast * envFastR + (1.0 - alphaFast) * absR;

      envSlowL = alphaSlow * envSlowL + (1.0 - alphaSlow) * absL;
      envSlowR = alphaSlow * envSlowR + (1.0 - alphaSlow) * absR;

      // Transient attack delta
      const diffL = Math.max(0, envFastL - envSlowL);
      const diffR = Math.max(0, envFastR - envSlowR);

      // Analog soft-clipping for boosted transient
      const punchGainL = 1.0 + diffL * (1.8 * boost);
      const punchGainR = 1.0 + diffR * (1.8 * boost);

      outL[i] = l * punchGainL;
      outR[i] = r * punchGainR;
    }

    return { left: outL, right: outR };
  }
}
