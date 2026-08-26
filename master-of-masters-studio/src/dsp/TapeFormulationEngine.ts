/**
 * Master of Masters Studio Pro — Master Tape Formulation & Vintage Bias Engine.
 * 
 * Formulations:
 * 1. 'pristine_2026' (Studer A800 1/2" 30 IPS — ultra-transparent, 0-hour tape headroom)
 * 2. 'vintage_1984_ampex456' (Ampex 456 Grand Master 15 IPS — warm mid saturation, tape compression)
 * 3. 'gold_chrome_type2' (Chrome High-Bias Type II — 80s/90s energetic punchy tape crunch)
 */

export type TapeFormulationType = 'pristine_2026' | 'vintage_1984_ampex456' | 'gold_chrome_type2';

export class TapeFormulationEngine {
  /**
   * Applies the physical magnetic formulation characteristics to the stereo signal.
   */
  public static processFormulation(
    left: Float32Array,
    right: Float32Array,
    formulation: TapeFormulationType = 'pristine_2026',
    drive = 0.40,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    let saturationCurveExponent = 1.0;
    let headBumpFreq = 65.0;
    let headBumpGainDb = 1.2;
    let hfRollOff = 18000.0;

    switch (formulation) {
      case 'pristine_2026':
        saturationCurveExponent = 1.1;
        headBumpFreq = 48.0;
        headBumpGainDb = 0.8;
        hfRollOff = 22000.0;
        break;
      case 'vintage_1984_ampex456':
        saturationCurveExponent = 1.6;
        headBumpFreq = 72.0;
        headBumpGainDb = 2.4;
        hfRollOff = 16000.0;
        break;
      case 'gold_chrome_type2':
        saturationCurveExponent = 1.4;
        headBumpFreq = 85.0;
        headBumpGainDb = 1.8;
        hfRollOff = 17500.0;
        break;
    }

    const headBumpGain = Math.pow(10, (headBumpGainDb * drive) / 20.0);
    const alphaBump = Math.exp((-2.0 * Math.PI * headBumpFreq) / sampleRate);
    const alphaRollOff = Math.exp((-2.0 * Math.PI * hfRollOff) / sampleRate);

    let bumpL = 0, bumpR = 0;
    let rollL = 0, rollR = 0;

    for (let i = 0; i < len; i++) {
      let l = left[i];
      let r = right[i];

      // 1. Magnetic Head Bump (Resonant low-end warmth)
      bumpL = alphaBump * bumpL + (1.0 - alphaBump) * l;
      bumpR = alphaBump * bumpR + (1.0 - alphaBump) * r;
      l += bumpL * (headBumpGain - 1.0);
      r += bumpR * (headBumpGain - 1.0);

      // 2. Non-linear Magnetic Flux Compression
      const satL = Math.tanh(l * (1.0 + drive * saturationCurveExponent));
      const satR = Math.tanh(r * (1.0 + drive * saturationCurveExponent));

      // 3. High-Frequency Tape Damping
      rollL = alphaRollOff * rollL + (1.0 - alphaRollOff) * satL;
      rollR = alphaRollOff * rollR + (1.0 - alphaRollOff) * satR;

      outL[i] = rollL;
      outR[i] = rollR;
    }

    return { left: outL, right: outR };
  }
}
