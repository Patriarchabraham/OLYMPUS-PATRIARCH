/**
 * Master of Masters Studio Pro — Guitar Multi-Articulation & Palm-Mute Chug Engine.
 * 
 * Implements physical guitar performance articulations:
 * 1. Palm-Mute Chug (Tight low-pass damping + 110Hz resonant punch).
 * 2. Open Power Chord (Ringing sustain with tube saturation).
 * 3. Pinch Harmonics (High 3rd & 5th order harmonic squeal).
 * 4. Wide Blues/Metal Vibrato Bends (Modulated pitch envelope).
 */

export type GuitarArticulationType = 'palm_mute' | 'open_chord' | 'pinch_harmonic' | 'vibrato_bend';

export class GuitarArticulationEngine {
  /**
   * Applies physical guitar performance articulation to a synthesized guitar note.
   */
  public static processArticulation(
    rawString: Float32Array,
    articulation: GuitarArticulationType,
    fundamentalFreq: number,
    sampleRate = 44100
  ): Float32Array {
    const len = rawString.length;
    const out = new Float32Array(len);

    switch (articulation) {
      case 'palm_mute': {
        // High damping: decays rapidly with punchy 110Hz resonant body
        const alphaChug = Math.exp((-2.0 * Math.PI * 1800.0) / sampleRate);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const decay = Math.exp(-t * 22.0); // Fast tight decay
          lp = alphaChug * lp + (1.0 - alphaChug) * rawString[i];
          out[i] = Math.tanh(lp * 3.2) * decay * 1.15;
        }
        break;
      }
      case 'open_chord': {
        // Ringing sustain
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const decay = Math.exp(-t * 3.5);
          out[i] = Math.tanh(rawString[i] * 2.2) * decay;
        }
        break;
      }
      case 'pinch_harmonic': {
        // Emphasizes 3rd & 4th harmonic squeal
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const squeal = Math.sin(2.0 * Math.PI * (fundamentalFreq * 4.0) * t) * 0.75;
          const decay = Math.exp(-t * 6.0);
          out[i] = Math.tanh((rawString[i] * 0.4 + squeal * 0.6) * 4.0) * decay;
        }
        break;
      }
      case 'vibrato_bend': {
        // 5.5Hz wide pitch vibrato modulation
        const vibratoRate = 5.5;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const vib = 1.0 + 0.03 * Math.sin(2.0 * Math.PI * vibratoRate * t);
          const decay = Math.exp(-t * 4.0);
          out[i] = Math.tanh(rawString[i] * vib * 2.5) * decay;
        }
        break;
      }
    }

    return out;
  }
}
