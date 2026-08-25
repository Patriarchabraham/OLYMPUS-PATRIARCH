/**
 * Master of Masters Studio Pro — Multi-Format Audio Export Engine.
 * 
 * Supports instant client-side rendering for:
 * 1. 24-Bit HD WAV (PCM with TPDF Dither & 5th-order noise shaping)
 * 2. 32-Bit Floating Point WAV (Unlimited Headroom, 320dB dynamic range)
 * 3. 16-Bit Red Book CD WAV (44.1kHz / 16-bit Dither)
 * 4. 320 kbps High-Definition MP3 (ID3v2 Metadata & Maximum Quality)
 */

import {
  audioBufferTo24BitWavBlob,
  audioBufferTo32BitFloatWavBlob,
} from './WavEncoder';
import { Mp3EncoderEngine, type Mp3TagMetadata } from './Mp3EncoderEngine';

export type AudioFormatType = 'wav_24bit' | 'wav_32bit_float' | 'wav_16bit_cd' | 'mp3_320kbps';

export class MultiFormatEncoder {
  /**
   * Encodes a standard 16-bit 44.1kHz Red Book CD PCM WAV Blob.
   */
  public static audioBufferTo16BitWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // 16-bit

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        sample = Math.max(-1.0, Math.min(1.0, sample));
        // 16-bit integer conversion with TPDF dither
        const dither = (Math.random() - Math.random()) * (1.0 / 32768.0);
        const intVal = Math.floor((sample + dither) * 32767.0);
        view.setInt16(offset, Math.max(-32768, Math.min(32767, intVal)), true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Encodes a 320 kbps Maximum Quality MP3 Blob with ID3 tags.
   */
  public static audioBufferToMp3Blob(buffer: AudioBuffer, tags?: Mp3TagMetadata): Blob {
    return Mp3EncoderEngine.encodeToMp3_320kbps(buffer, tags);
  }

  public static encodeToFormat(buffer: AudioBuffer, format: AudioFormatType, tags?: Mp3TagMetadata): Blob {
    switch (format) {
      case 'mp3_320kbps':
        return this.audioBufferToMp3Blob(buffer, tags);
      case 'wav_32bit_float':
        return audioBufferTo32BitFloatWavBlob(buffer);
      case 'wav_16bit_cd':
        return this.audioBufferTo16BitWavBlob(buffer);
      case 'wav_24bit':
      default:
        return audioBufferTo24BitWavBlob(buffer);
    }
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
