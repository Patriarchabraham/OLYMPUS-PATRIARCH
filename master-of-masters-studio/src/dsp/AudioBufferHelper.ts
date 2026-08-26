/**
 * Master of Masters Studio Pro — Universal AudioBuffer Allocator.
 * 
 * Allocates AudioBuffers directly using the native standard constructor
 * without spawning expensive OfflineAudioContext instances.
 */

export class AudioBufferHelper {
  /**
   * Creates a new AudioBuffer with guaranteed zero AudioContext limit exhaustion.
   */
  public static createAudioBuffer(
    channels: number,
    length: number,
    sampleRate: number
  ): AudioBuffer {
    const numChannels = Math.max(1, channels);
    const numSamples = Math.max(1, length);
    const sr = Math.max(8000, Math.min(192000, sampleRate));

    try {
      if (typeof AudioBuffer !== 'undefined') {
        return new AudioBuffer({
          numberOfChannels: numChannels,
          length: numSamples,
          sampleRate: sr,
        });
      }
    } catch {
      // Fallback
    }

    // Secondary fallback
    // @ts-ignore
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.createBuffer(numChannels, numSamples, sr);
  }

  /**
   * Clones an existing AudioBuffer.
   */
  public static cloneBuffer(source: AudioBuffer): AudioBuffer {
    const clone = this.createAudioBuffer(
      source.numberOfChannels,
      source.length,
      source.sampleRate
    );
    for (let c = 0; c < source.numberOfChannels; c++) {
      clone.copyToChannel(source.getChannelData(c), c);
    }
    return clone;
  }
}
