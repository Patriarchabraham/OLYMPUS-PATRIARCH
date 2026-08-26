/**
 * Master of Masters Studio Pro — Acoustic-to-Heavy Dynamic Explosion Engine.
 * 
 * Synthesizes intimate 12-string acoustic guitar arpeggios with chime harmonics,
 * leading into a dynamic snare roll & cymbal swell crescendo, followed by a
 * massive explosion into full high-gain metal rhythm walls.
 */

export class AcousticToHeavyDynamicEngine {
  /**
   * Generates a lush 12-string acoustic intro arpeggio.
   */
  public static synthesizeAcousticIntro(
    durationSec: number,
    baseRootFreq: number,
    scaleIntervals: number[],
    bpm: number,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const totalSamples = Math.floor(durationSec * sampleRate);
    const outL = new Float32Array(totalSamples);
    const outR = new Float32Array(totalSamples);

    const secPerBeat = 60.0 / bpm;
    const samplesPerBeat = Math.floor(secPerBeat * sampleRate);
    const arpeggioPicks = [0, 2, 4, 7, 5, 4, 2, 0]; // 8-step delicate arpeggio

    const totalBars = Math.floor(totalSamples / (samplesPerBeat * 4));

    for (let bar = 0; bar < totalBars; bar++) {
      const barStart = bar * samplesPerBeat * 4;
      const rootOffset = bar === 1 ? 8 : bar === 2 ? 5 : bar === 3 ? 7 : 0;
      const root = baseRootFreq * Math.pow(2.0, scaleIntervals[rootOffset % scaleIntervals.length] / 12.0);

      for (let step = 0; step < 8; step++) {
        const stepStart = barStart + Math.floor((step / 8) * samplesPerBeat * 4);
        const deg = arpeggioPicks[step];
        const f1 = root * 2.0 * Math.pow(2.0, scaleIntervals[deg % scaleIntervals.length] / 12.0);
        const fOctave = f1 * 2.002; // 12-string octave sparkle

        const noteLen = Math.floor(samplesPerBeat * 0.9);
        const pan = (step % 2 === 0) ? -0.45 : 0.45;

        for (let s = 0; s < Math.min(noteLen, totalSamples - stepStart); s++) {
          const t = s / sampleRate;
          const decay = Math.exp(-t * 5.5);
          // Pure acoustic chime waveform
          const acWave = (Math.sin(2.0 * Math.PI * f1 * t) * 0.7 + Math.sin(2.0 * Math.PI * fOctave * t) * 0.3) * decay * 0.55;
          outL[stepStart + s] += acWave * Math.max(0, 1.0 - pan);
          outR[stepStart + s] += acWave * Math.max(0, 1.0 + pan);
        }
      }
    }

    return { left: outL, right: outR };
  }
}
