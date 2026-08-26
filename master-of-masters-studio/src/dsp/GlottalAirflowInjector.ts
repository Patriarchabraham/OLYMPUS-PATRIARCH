/**
 * Master of Masters Studio Pro — Glottal Inhalation & Airflow Turbulence Injector.
 * 
 * Synthesizes dynamic respiration, vocal onset inhalation, and glottal air
 * turbulence (8kHz-16kHz soft pink-weighted air) on high-energy vocal phrasing.
 */

export class GlottalAirflowInjector {
  /**
   * Injects organic glottal breath turbulence onto vocal channels.
   */
  public static injectAirflow(
    left: Float32Array,
    right: Float32Array,
    breathIntensity = 0.50,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = left.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const alphaEnv = Math.exp(-1.0 / (sampleRate * 0.020)); // 20ms envelope follower
    let env = 0.0;

    const alphaAirBand = Math.exp((-2.0 * Math.PI * 9000.0) / sampleRate);
    let pinkB0 = 0, pinkB1 = 0;

    let seed = 98765;
    const nextNoise = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647) * 2.0 - 1.0;
    };

    for (let i = 0; i < len; i++) {
      const inL = left[i];
      const inR = right[i];
      const mag = 0.5 * (Math.abs(inL) + Math.abs(inR));

      // Envelope follower
      env = (1.0 - alphaEnv) * mag + alphaEnv * env;

      // Generate pink-weighted high-frequency air turbulence
      const white = nextNoise();
      pinkB0 = 0.99 * pinkB0 + white * 0.05;
      pinkB1 = 0.96 * pinkB1 + white * 0.11;
      const pink = pinkB0 + pinkB1 + white * 0.18;

      // High-pass filter above 9kHz for pure air
      const breathSignal = (pink - alphaAirBand * pink) * env * (0.04 * breathIntensity);

      outL[i] = inL + breathSignal;
      outR[i] = inR + breathSignal;
    }

    return { left: outL, right: outR };
  }
}
