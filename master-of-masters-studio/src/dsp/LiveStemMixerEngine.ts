/**
 * Master of Masters Studio Pro — Live 4-Stem Mixer Engine.
 * 
 * Provides real-time and offline multi-track stem mixing:
 * - 🥁 Drums (Gain, Pan, Solo, Mute)
 * - 🎸 Bass (Gain, Pan, Solo, Mute)
 * - ⚡ Guitars (Gain, Pan, Solo, Mute)
 * - 🎤 Vocals (Gain, Pan, Solo, Mute)
 */

import { AudioBufferHelper } from './AudioBufferHelper';

export interface StemChannelState {
  gain: number; // 0.0 to 2.0 (1.0 = 0dB)
  pan: number;  // -1.0 (L) to +1.0 (R)
  muted: boolean;
  solo: boolean;
}

export interface StemMixerConfig {
  drums: StemChannelState;
  bass: StemChannelState;
  guitars: StemChannelState;
  vocals: StemChannelState;
}

export class LiveStemMixerEngine {
  /**
   * Sums the 4 discrete stem buffers into a master mixed AudioBuffer based on mixer states.
   */
  public static mixStems(
    stems: { drums: AudioBuffer; bass: AudioBuffer; guitars: AudioBuffer; vocals: AudioBuffer },
    config: StemMixerConfig
  ): AudioBuffer {
    const len = stems.drums.length;
    const sr = stems.drums.sampleRate;
    const out = AudioBufferHelper.createAudioBuffer(2, len, sr);
    const outL = out.getChannelData(0);
    const outR = out.getChannelData(1);

    const isAnySolo = config.drums.solo || config.bass.solo || config.guitars.solo || config.vocals.solo;

    const shouldPlay = (ch: StemChannelState) => {
      if (ch.muted) return false;
      if (isAnySolo) return ch.solo;
      return true;
    };

    const processStem = (buf: AudioBuffer, ch: StemChannelState) => {
      if (!shouldPlay(ch)) return;
      const bL = buf.getChannelData(0);
      const bR = buf.getChannelData(1);
      const panL = Math.max(0, 1.0 - ch.pan);
      const panR = Math.max(0, 1.0 + ch.pan);

      for (let i = 0; i < len; i++) {
        outL[i] += bL[i] * ch.gain * panL;
        outR[i] += bR[i] * ch.gain * panR;
      }
    };

    processStem(stems.drums, config.drums);
    processStem(stems.bass, config.bass);
    processStem(stems.guitars, config.guitars);
    processStem(stems.vocals, config.vocals);

    // Soft analog bus limiter
    for (let i = 0; i < len; i++) {
      outL[i] = Math.tanh(outL[i] * 0.90);
      outR[i] = Math.tanh(outR[i] * 0.90);
    }

    return out;
  }
}
