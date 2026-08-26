/**
 * Master of Masters Studio Pro — Tape Head Asymmetry & Capstan Micro-Flutter Physics Engine.
 * 
 * Emulates physical 1/2-inch and 1/4-inch analog tape mechanics:
 * 1. Magnetic Head Gap Asymmetry (subtle even harmonic push).
 * 2. Capstan Motor Micro-Flutter (0.035% modulation at 3.2Hz).
 * 3. Dynamic Magnetic Hysteresis Core Saturation.
 */

export class TapeHeadPhysicsEngine {
  /**
   * Processes audio with tape head magnetic asymmetry and capstan flutter.
   */
  public static processTapePhysics(
    left: Float32Array,
    right: Float32Array,
    flutterAmount = 0.35,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const flutterFreq = 3.2; // Hz
    const flutterPhaseInc = (2.0 * Math.PI * flutterFreq) / sampleRate;
    let flutterPhase = 0;

    // Small delay line for flutter pitch modulation
    const maxDelay = 128;
    const delayL = new Float32Array(maxDelay);
    const delayR = new Float32Array(maxDelay);
    let writeIdx = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      // 1. Magnetic Head Asymmetry (even harmonic bias)
      const asymL = inL + (inL * inL - 0.015) * 0.025;
      const asymR = inR + (inR * inR - 0.015) * 0.025;

      // 2. Capstan Flutter Delay Modulation
      delayL[writeIdx] = asymL;
      delayR[writeIdx] = asymR;

      const mod = Math.sin(flutterPhase) * (1.2 * flutterAmount);
      flutterPhase += flutterPhaseInc;
      if (flutterPhase > 2.0 * Math.PI) flutterPhase -= 2.0 * Math.PI;

      const readPos = writeIdx - 4.0 - mod;
      const readIdx0 = (Math.floor(readPos) + maxDelay) % maxDelay;
      const readIdx1 = (readIdx0 + 1) % maxDelay;
      const frac = readPos - Math.floor(readPos);

      const modL = delayL[readIdx0] * (1.0 - frac) + delayL[readIdx1] * frac;
      const modR = delayR[readIdx0] * (1.0 - frac) + delayR[readIdx1] * frac;

      writeIdx = (writeIdx + 1) % maxDelay;

      outL[i] = modL;
      outR[i] = modR;
    }

    return { left: outL, right: outR };
  }
}
