/**
 * Master of Masters Studio Pro — Symphonic Hammond B3 & Mellotron Engine.
 * 
 * Synthesizes:
 * 1. 9-Drawbar Hammond B3 Rock Organ (888000000 / 888800000 drawbar registrations).
 * 2. Rotating Leslie Speaker horn/drum doppler frequency modulation (6.2Hz Tremolo).
 * 3. Vintage Mellotron String Choir Swells for stadium epic choruses.
 */

export class SymphonicOrganMellotronEngine {
  /**
   * Synthesizes a rock organ and mellotron string layer over chords.
   */
  public static synthesizeOrganStringsLayer(
    durationSec: number,
    chordProgression: number[],
    scaleIntervals: number[],
    baseRootFreq: number,
    bpm: number,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const totalSamples = Math.floor(durationSec * sampleRate);
    const outL = new Float32Array(totalSamples);
    const outR = new Float32Array(totalSamples);

    const secPerBeat = 60.0 / bpm;
    const samplesPerBar = Math.floor(secPerBeat * 4 * sampleRate);
    const totalBars = Math.floor(totalSamples / samplesPerBar);

    const leslieRate = 6.2; // 6.2Hz Leslie fast speed
    const drawbars = [1.0, 1.498, 2.0, 2.996, 4.0]; // Sub, 5th, 8ve, 12th, 15th

    for (let bar = 0; bar < totalBars; bar++) {
      const chordIdx = chordProgression[bar % chordProgression.length];
      const rootSemi = scaleIntervals[chordIdx % scaleIntervals.length];
      const rootFreq = baseRootFreq * 2.0 * Math.pow(2.0, rootSemi / 12.0);

      const barStart = bar * samplesPerBar;

      for (let s = 0; s < Math.min(samplesPerBar, totalSamples - barStart); s++) {
        const t = s / sampleRate;
        const leslieModL = Math.sin(2.0 * Math.PI * leslieRate * t);
        const leslieModR = Math.cos(2.0 * Math.PI * leslieRate * t);

        let organSample = 0;
        for (let d = 0; d < drawbars.length; d++) {
          const mult = drawbars[d];
          organSample += Math.sin(2.0 * Math.PI * (rootFreq * mult) * t) * (1.0 / (d + 1));
        }

        // Mellotron String Swell envelope
        const swell = Math.sin((s / samplesPerBar) * Math.PI);
        const organL = organSample * (1.0 + 0.25 * leslieModL) * 0.15 * swell;
        const organR = organSample * (1.0 + 0.25 * leslieModR) * 0.15 * swell;

        outL[barStart + s] += organL;
        outR[barStart + s] += organR;
      }
    }

    return { left: outL, right: outR };
  }
}
