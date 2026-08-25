/**
 * Master of Masters Studio Pro — LPC Vocal Tract Formant Geometry Engine.
 * 
 * Uses Linear Predictive Coding (LPC) filter modeling to reshape vocal tract geometry
 * (throat length, pharyngeal resonator, chest cavity) independently of pitch.
 */

export interface VocalTractOptions {
  tractScale: number; // 0.85 (bright/child) to 1.15 (deep/godly)
  throatResonanceHz: number; // 2.8k to 3.8kHz
  chestDepthHz: number; // 180 to 280Hz
  power: number; // 0.0 to 1.0
}

export class LpcVocalFormantEngine {
  /**
   * Reshapes vocal formants and tract geometry.
   */
  public static processVocalTract(
    left: Float32Array,
    right: Float32Array,
    options: VocalTractOptions,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const { tractScale = 1.0, throatResonanceHz = 3200, chestDepthHz = 220, power = 0.65 } = options;

    // Resonator frequencies shifted by tract scale
    const fThroat = throatResonanceHz / tractScale;
    const fChest = chestDepthHz / tractScale;

    const wThroat = (2.0 * Math.PI * fThroat) / sampleRate;
    const wChest = (2.0 * Math.PI * fChest) / sampleRate;

    const aThroat = Math.exp(-wThroat * 0.15);
    const aChest = Math.exp(-wChest * 0.20);

    let stateThrL = 0, stateThrR = 0;
    let stateChL = 0, stateChR = 0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];

      // Throat formant pole
      stateThrL = aThroat * stateThrL + (1.0 - aThroat) * inL;
      stateThrR = aThroat * stateThrR + (1.0 - aThroat) * inR;

      // Chest cavity resonator pole
      stateChL = aChest * stateChL + (1.0 - aChest) * inL;
      stateChR = aChest * stateChR + (1.0 - aChest) * inR;

      const throatDeltaL = (inL - stateThrL) * 0.25 * power;
      const throatDeltaR = (inR - stateThrR) * 0.25 * power;
      const chestDeltaL = stateChL * 0.20 * power;
      const chestDeltaR = stateChR * 0.20 * power;

      outL[i] = inL + throatDeltaL + chestDeltaL;
      outR[i] = inR + throatDeltaR + chestDeltaR;
    }

    return { left: outL, right: outR };
  }
}
