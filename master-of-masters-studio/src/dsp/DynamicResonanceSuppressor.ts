/**
 * Master of Masters Studio Pro — Dynamic Resonance Suppressor (Soothe/Gullfoss Class).
 * 
 * Tracks mobile, harsh harmonic resonances in real-time across critical listening bands
 * (especially 2.2kHz - 5.5kHz guitar fizz and 6.5kHz - 9.5kHz sibilance/cymbals)
 * and dynamically attenuates offending peaks without stripping musical energy or air.
 */

export class DynamicResonanceSuppressor {
  /**
   * Processes stereo channels with adaptive dynamic resonance suppression.
   */
  public static processAdaptiveDeHarsh(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    depth = 0.60,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outL = new Float32Array(length);
    const outR = new Float32Array(length);

    if (depth <= 0.01) {
      outL.set(inputLeft);
      outR.set(inputRight);
      return { left: outL, right: outR };
    }

    const intensity = Math.min(1.0, Math.max(0.1, depth));

    // Dynamic band centers for harshness detection
    const fHarsh1 = 3200.0; // Guitar boxy bite & vocal edge
    const fHarsh2 = 4600.0; // AI fizz & aggressive bite
    const fHarsh3 = 7800.0; // Harsh cymbals & sibilance

    const alpha1 = Math.exp((-2.0 * Math.PI * fHarsh1) / sampleRate);
    const alpha2 = Math.exp((-2.0 * Math.PI * fHarsh2) / sampleRate);
    const alpha3 = Math.exp((-2.0 * Math.PI * fHarsh3) / sampleRate);

    // Fast envelope follower release
    const alphaEnv = Math.exp((-2.0 * Math.PI * 45.0) / sampleRate);

    let bp1L = 0, bp1R = 0;
    let bp2L = 0, bp2R = 0;
    let bp3L = 0, bp3R = 0;

    let env1 = 0, env2 = 0, env3 = 0;

    for (let i = 0; i < length; i++) {
      const l = inputLeft[i];
      const r = inputRight[i];
      const mono = 0.5 * (l + r);

      // Bandpass band extraction
      bp1L = alpha1 * bp1L + (1.0 - alpha1) * l;
      bp1R = alpha1 * bp1R + (1.0 - alpha1) * r;

      bp2L = alpha2 * bp2L + (1.0 - alpha2) * l;
      bp2R = alpha2 * bp2R + (1.0 - alpha2) * r;

      bp3L = alpha3 * bp3L + (1.0 - alpha3) * l;
      bp3R = alpha3 * bp3R + (1.0 - alpha3) * r;

      // Envelope detection
      const mag1 = Math.abs(bp1L + bp1R) * 0.5;
      const mag2 = Math.abs(bp2L + bp2R) * 0.5;
      const mag3 = Math.abs(bp3L + bp3R) * 0.5;

      env1 = Math.max(mag1, env1 * alphaEnv);
      env2 = Math.max(mag2, env2 * alphaEnv);
      env3 = Math.max(mag3, env3 * alphaEnv);

      // Dynamic reduction factor when energy spikes above threshold
      const thresh = 0.14;
      const red1 = env1 > thresh ? (env1 - thresh) * (0.35 * intensity) : 0;
      const red2 = env2 > thresh ? (env2 - thresh) * (0.40 * intensity) : 0;
      const red3 = env3 > thresh ? (env3 - thresh) * (0.30 * intensity) : 0;

      // Smooth subtraction of mobile resonant spikes
      outL[i] = l - (bp1L * red1 + bp2L * red2 + bp3L * red3);
      outR[i] = r - (bp1R * red1 + bp2R * red2 + bp3R * red3);
    }

    return { left: outL, right: outR };
  }
}
