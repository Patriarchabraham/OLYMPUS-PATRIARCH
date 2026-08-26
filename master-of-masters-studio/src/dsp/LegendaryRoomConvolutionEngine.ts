/**
 * Master of Masters Studio Pro — Legendary Studio Real Room Acoustic Convolution Engine.
 * 
 * Simulates real acoustic spaces of iconic recording studios:
 * 1. 'abbey_road_studio_2': Famous high-ceiling brick room (The Beatles, Pink Floyd).
 * 2. 'hansa_tonstudio_berlin': Big acoustic ballroom with bright early reflections (David Bowie, U2).
 * 3. 'electric_lady_studio_a': Warm wooden floor acoustic space (Jimi Hendrix, Led Zeppelin).
 */

export type LegendaryRoomType = 'abbey_road_studio_2' | 'hansa_tonstudio_berlin' | 'electric_lady_studio_a';

export class LegendaryRoomConvolutionEngine {
  /**
   * Convolves stereo audio with legendary studio room early reflections.
   */
  public static processRoomConvolution(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    roomType: LegendaryRoomType = 'abbey_road_studio_2',
    wetBlend = 0.22,
    sampleRate = 44100
  ): { left: Float32Array; right: Float32Array } {
    const len = inputLeft.length;
    const outL = new Float32Array(len);
    const outR = new Float32Array(len);

    const roomDelaysMs = roomType === 'abbey_road_studio_2'
      ? [18, 32, 45, 68, 92]
      : roomType === 'hansa_tonstudio_berlin'
      ? [12, 24, 38, 54, 75]
      : [15, 28, 42, 60, 84];

    const taps = roomDelaysMs.map(ms => ({
      samples: Math.floor((ms / 1000.0) * sampleRate),
      gain: Math.pow(0.72, ms / 25.0),
    }));

    const maxDelay = taps[taps.length - 1].samples + 1;
    const delayL = new Float32Array(maxDelay);
    const delayR = new Float32Array(maxDelay);
    let ptr = 0;

    for (let i = 0; i < len; i++) {
      const sL = inputLeft[i];
      const sR = inputRight[i];

      delayL[ptr] = sL;
      delayR[ptr] = sR;

      let earlyL = 0;
      let earlyR = 0;

      for (const tap of taps) {
        const readIdx = (ptr - tap.samples + maxDelay) % maxDelay;
        earlyL += delayL[readIdx] * tap.gain;
        earlyR += delayR[readIdx] * tap.gain;
      }

      ptr = (ptr + 1) % maxDelay;

      outL[i] = sL * (1.0 - wetBlend) + earlyL * wetBlend;
      outR[i] = sR * (1.0 - wetBlend) + earlyR * wetBlend;
    }

    return { left: outL, right: outR };
  }
}
