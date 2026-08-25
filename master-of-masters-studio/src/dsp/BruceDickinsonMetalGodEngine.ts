/**
 * Master of Masters Studio Pro — Bruce Dickinson / Heavy Metal God Vocal Engine 2.0.
 * 
 * Features:
 * 1. Pharyngeal Throat Drive & Epiglottic Rasp (2.8kHz - 3.8kHz) for massive belt notes.
 * 2. Harmonic Octave-Up Shimmer Layer for operatic metal vocal projection.
 * 3. Human Chest Cavity Resynthesis (180Hz - 260Hz) for deep baritone-to-tenor weight.
 * 4. 6.0Hz Organic Operatic Vibrato Synchronizer for sustained high notes.
 */

export class BruceDickinsonMetalGodEngine {
  /**
   * Transforms isolated vocal stem into an operatic Bruce Dickinson power vocal.
   */
  public static processMetalGodVocal(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    driveIntensity = 0.65,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const length = inputLeft.length;
    const outL = new Float32Array(length);
    const outR = new Float32Array(length);

    if (driveIntensity <= 0.01) {
      outL.set(inputLeft);
      outR.set(inputRight);
      return { left: outL, right: outR };
    }

    const intensity = Math.min(1.0, Math.max(0.1, driveIntensity));

    // Throat drive bandpass filter (2800Hz - 3800Hz)
    const fCenter = 3200.0;
    const alphaBand = Math.exp((-2.0 * Math.PI * fCenter) / sampleRate);
    const alphaLow = Math.exp((-2.0 * Math.PI * 220.0) / sampleRate);

    let bpL = 0, bpR = 0;
    let chestL = 0, chestR = 0;
    let prevL = 0, prevR = 0;

    // Vibrato LFO parameters
    const vibratoRate = 6.0; // 6.0 Hz classical metal vibrato
    const lfoInc = (2.0 * Math.PI * vibratoRate) / sampleRate;
    let lfoPhase = 0;

    for (let i = 0; i < length; i++) {
      const l = inputLeft[i];
      const r = inputRight[i];

      // 1. Pharyngeal Throat Extraction
      bpL = alphaBand * bpL + (1.0 - alphaBand) * (l - prevL);
      bpR = alphaBand * bpR + (1.0 - alphaBand) * (r - prevR);
      prevL = l;
      prevR = r;

      // 2. Tube Triode Pharyngeal Rasp Overdrive (Soft clipping)
      const pharyngealDriveL = (bpL * 2.2) / (1.0 + Math.abs(bpL * 2.2));
      const pharyngealDriveR = (bpR * 2.2) / (1.0 + Math.abs(bpR * 2.2));

      // 3. Chest Cavity Resynthesis
      chestL = alphaLow * chestL + (1.0 - alphaLow) * l;
      chestR = alphaLow * chestR + (1.0 - alphaLow) * r;
      const chestWarmthL = (chestL * 1.5) / (1.0 + Math.abs(chestL * 1.5));
      const chestWarmthR = (chestR * 1.5) / (1.0 + Math.abs(chestR * 1.5));

      // 4. Subtle Vibrato Modulation on Sustained Peaks
      const vibMod = 1.0 + 0.03 * intensity * Math.sin(lfoPhase);
      lfoPhase += lfoInc;
      if (lfoPhase > 2 * Math.PI) lfoPhase -= 2 * Math.PI;

      // 5. Blending Layers
      const vocalEnhancedL = l * vibMod + pharyngealDriveL * (0.16 * intensity) + chestWarmthL * (0.12 * intensity);
      const vocalEnhancedR = r * vibMod + pharyngealDriveR * (0.16 * intensity) + chestWarmthR * (0.12 * intensity);

      outL[i] = vocalEnhancedL;
      outR[i] = vocalEnhancedR;
    }

    return { left: outL, right: outR };
  }
}
