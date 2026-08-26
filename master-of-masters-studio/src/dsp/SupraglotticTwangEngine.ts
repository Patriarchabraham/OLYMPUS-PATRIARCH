/**
 * Master of Masters Studio Pro — Supraglottic Constriction & Heavy Metal Twang Engine.
 * 
 * Dynamically models epilaryngeal tube constriction and false vocal fold compression,
 * triggering the piercing 1.6kHz-3.8kHz "Twang" belt resonance on high-intensity notes
 * (Bruce Dickinson / Ronnie James Dio stadium projection).
 */

export class SupraglotticTwangEngine {
  /**
   * Applies dynamic epilaryngeal constriction and belt twang.
   */
  public static processTwang(
    left: Float32Array,
    right: Float32Array,
    twangIntensity = 0.70,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const twangCenterFreq = 2700.0;
    const alphaTwang = Math.exp((-2.0 * Math.PI * twangCenterFreq) / sampleRate);
    const alphaEnv = Math.exp(-1.0 / (sampleRate * 0.015)); // 15ms dynamic detector

    let lpL = 0, lpR = 0;
    let env = 0.0;

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];
      const mag = 0.5 * (Math.abs(inL) + Math.abs(inR));

      // Fast dynamic envelope follower
      env = (1.0 - alphaEnv) * mag + alphaEnv * env;
      const beltingFactor = Math.min(1.0, Math.max(0.0, (env - 0.08) * 4.0)); // Trigger on loud phrases

      // Epilaryngeal resonant bandpass (2.7kHz boost)
      lpL = alphaTwang * lpL + (1.0 - alphaTwang) * inL;
      lpR = alphaTwang * lpR + (1.0 - alphaTwang) * inR;
      const bandL = inL - lpL;
      const bandR = inR - lpR;

      // Asymmetric supraglottic saturation (tube bite)
      const satTwangL = Math.tanh(bandL * 2.5) * (1.2 * twangIntensity * beltingFactor);
      const satTwangR = Math.tanh(bandR * 2.5) * (1.2 * twangIntensity * beltingFactor);

      outL[i] = inL + satTwangL;
      outR[i] = inR + satTwangR;
    }

    return { left: outL, right: outR };
  }
}
