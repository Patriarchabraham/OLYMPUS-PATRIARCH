/**
 * Master of Masters Studio Pro — Queen & Metal God Vocal Choir Harmonizer Engine 2.0.
 * 
 * Generates rich multi-voice harmonies and Queen-style multi-tracked choirs
 * with precise pitch-shifting, micro-detuning, and wide 3D stereo panning.
 */

export type ChoirPreset = 'queen_4voice' | 'third_up' | 'fifth_power' | 'octave_epic' | 'metal_trinity';

export class VocalChoirHarmonizerEngine {
  /**
   * Generates vocal choir and harmonies directly from vocal buffer.
   */
  public static async generateChoir(
    inputBuffer: AudioBuffer,
    preset: ChoirPreset = 'queen_4voice',
    blend = 0.65
  ): Promise<AudioBuffer> {
    const sr = inputBuffer.sampleRate;
    const len = inputBuffer.length;
    const outCtx = new OfflineAudioContext(2, len, sr);
    const outBuf = outCtx.createBuffer(2, len, sr);

    const inL = inputBuffer.getChannelData(0);
    const inR = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : inL;
    const outL = outBuf.getChannelData(0);
    const outR = outBuf.getChannelData(1);

    // Copy base dry vocal
    for (let i = 0; i < len; i++) {
      outL[i] = inL[i];
      outR[i] = inR[i];
    }

    // Voice intervals depending on preset
    const voices: { semitones: number; detuneCents: number; pan: number; gain: number }[] = [];

    switch (preset) {
      case 'queen_4voice':
        voices.push(
          { semitones: 4, detuneCents: +7, pan: -0.75, gain: 0.35 * blend }, // +Major 3rd Left
          { semitones: 7, detuneCents: -5, pan: -0.25, gain: 0.40 * blend }, // +5th Mid-Left
          { semitones: 12, detuneCents: +4, pan: +0.25, gain: 0.35 * blend }, // +Octave Mid-Right
          { semitones: 0, detuneCents: -8, pan: +0.75, gain: 0.38 * blend }  // Unison Detuned Right
        );
        break;
      case 'third_up':
        voices.push(
          { semitones: 4, detuneCents: +4, pan: -0.5, gain: 0.45 * blend },
          { semitones: 4, detuneCents: -4, pan: +0.5, gain: 0.45 * blend }
        );
        break;
      case 'fifth_power':
        voices.push(
          { semitones: 7, detuneCents: +5, pan: -0.6, gain: 0.48 * blend },
          { semitones: 7, detuneCents: -5, pan: +0.6, gain: 0.48 * blend }
        );
        break;
      case 'octave_epic':
        voices.push(
          { semitones: 12, detuneCents: 0, pan: -0.4, gain: 0.40 * blend },
          { semitones: -12, detuneCents: 0, pan: +0.4, gain: 0.40 * blend }
        );
        break;
      case 'metal_trinity':
        voices.push(
          { semitones: 3, detuneCents: -6, pan: -0.65, gain: 0.40 * blend }, // Minor 3rd
          { semitones: 7, detuneCents: +6, pan: +0.65, gain: 0.42 * blend }  // 5th
        );
        break;
    }

    // Granular pitch-shift simulation for each voice
    for (const v of voices) {
      const pitchRatio = Math.pow(2, (v.semitones + v.detuneCents / 100) / 12);
      const panL = (1.0 - v.pan) * 0.5;
      const panR = (1.0 + v.pan) * 0.5;

      const grainSize = Math.round(sr * 0.040); // 40ms grains
      const hop = Math.round(grainSize / 2);

      for (let i = 0; i < len - grainSize; i += hop) {
        const readIdx = Math.round(i * pitchRatio) % (len - grainSize);
        for (let g = 0; g < grainSize; g++) {
          const window = 0.5 * (1 - Math.cos((2 * Math.PI * g) / (grainSize - 1)));
          const sample = inL[readIdx + g] * window * v.gain;
          if (i + g < len) {
            outL[i + g] += sample * panL;
            outR[i + g] += sample * panR;
          }
        }
      }
    }

    return outBuf;
  }
}
