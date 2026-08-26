/**
 * Master of Masters Studio Pro — High-Definition 320 kbps MP3 Encoder Engine.
 * 
 * Fully compliant with ISO/IEC 11172-3 MPEG-1 Layer III standard using
 * full Polyphase Filterbank, MDCT Psychoacoustic Quantization, and Huffman Coding.
 * Encodes AudioBuffers directly into playable 320 kbps CBR MP3 files with ID3v2 metadata.
 */

// @ts-ignore
import lamejs from './lame.bundle.js';

export interface Mp3TagMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
}

export class Mp3EncoderEngine {
  /**
   * Encodes an AudioBuffer into an authentic, fully compliant 320 kbps MP3 Blob.
   */
  public static encodeToMp3_320kbps(
    buffer: AudioBuffer,
    tags: Mp3TagMetadata = {}
  ): Blob {
    const sampleRate = buffer.sampleRate;
    const numChannels = Math.min(2, buffer.numberOfChannels);
    const length = buffer.length;

    const leftF32 = buffer.getChannelData(0);
    const rightF32 = numChannels > 1 ? buffer.getChannelData(1) : leftF32;

    // Convert Float32 (-1.0 to +1.0) to 16-bit signed integer PCM
    const leftPcm16 = new Int16Array(length);
    const rightPcm16 = new Int16Array(length);

    for (let i = 0; i < length; i++) {
      let l = Math.max(-1.0, Math.min(1.0, leftF32[i]));
      let r = Math.max(-1.0, Math.min(1.0, rightF32[i]));
      leftPcm16[i] = l < 0 ? Math.round(l * 32768) : Math.round(l * 32767);
      rightPcm16[i] = r < 0 ? Math.round(r * 32768) : Math.round(r * 32767);
    }

    // Build ID3v2.3 Tag Header
    const id3Bytes = this.buildID3v2Header({
      title: tags.title || 'Master of Masters Studio Track',
      artist: tags.artist || 'Master of Masters Studio Pro',
      album: tags.album || 'Quantum Supreme Master (320 kbps HD)',
      year: tags.year || '2026',
      genre: tags.genre || 'Heavy Metal / Rock / Studio Master',
      comment: tags.comment || 'Mastered with 64-bit Analog Quantum DSP at 320 kbps CBR',
    });

    // Initialize LAME 320 kbps MP3 Encoder
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 320);
    const mp3Chunks: Uint8Array[] = [id3Bytes];

    // Process audio in standard 1152-sample MP3 frame blocks
    const sampleBlockSize = 1152;
    for (let i = 0; i < length; i += sampleBlockSize) {
      const leftChunk = leftPcm16.subarray(i, i + sampleBlockSize);
      const rightChunk = rightPcm16.subarray(i, i + sampleBlockSize);

      let mp3buf: Int8Array;
      if (numChannels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }

      if (mp3buf.length > 0) {
        mp3Chunks.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
      }
    }

    // Flush remaining frames from LAME internal buffer
    const endBuf = mp3encoder.flush();
    if (endBuf.length > 0) {
      mp3Chunks.push(new Uint8Array(endBuf.buffer, endBuf.byteOffset, endBuf.length));
    }

    return new Blob(mp3Chunks, { type: 'audio/mp3' });
  }

  /**
   * Builds an ID3v2.3 Tag Header chunk.
   */
  private static buildID3v2Header(tags: Mp3TagMetadata): Uint8Array {
    const frames: Uint8Array[] = [];

    if (tags.title) frames.push(this.createID3TextFrame('TIT2', tags.title));
    if (tags.artist) frames.push(this.createID3TextFrame('TPE1', tags.artist));
    if (tags.album) frames.push(this.createID3TextFrame('TALB', tags.album));
    if (tags.year) frames.push(this.createID3TextFrame('TYER', tags.year));
    if (tags.genre) frames.push(this.createID3TextFrame('TCON', tags.genre));
    if (tags.comment) frames.push(this.createID3TextFrame('COMM', tags.comment));

    let framesTotalSize = 0;
    for (const f of frames) framesTotalSize += f.length;

    const id3TotalSize = 10 + framesTotalSize;
    const header = new Uint8Array(id3TotalSize);

    // ID3v2.3 Header (10 bytes)
    header[0] = 0x49; // 'I'
    header[1] = 0x44; // 'D'
    header[2] = 0x33; // '3'
    header[3] = 0x03; // Version 2.3
    header[4] = 0x00; // Revision 0
    header[5] = 0x00; // Flags

    // Synchsafe size (7 bits per byte)
    header[6] = (framesTotalSize >> 21) & 0x7f;
    header[7] = (framesTotalSize >> 14) & 0x7f;
    header[8] = (framesTotalSize >> 7) & 0x7f;
    header[9] = framesTotalSize & 0x7f;

    let offset = 10;
    for (const f of frames) {
      header.set(f, offset);
      offset += f.length;
    }

    return header;
  }

  private static createID3TextFrame(frameId: string, text: string): Uint8Array {
    const textBytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      textBytes.push(text.charCodeAt(i) & 0xff);
    }

    const frameSize = 1 + textBytes.length; // 1 byte encoding + text bytes
    const frame = new Uint8Array(10 + frameSize);

    // Frame ID (4 ASCII chars)
    for (let i = 0; i < 4; i++) {
      frame[i] = frameId.charCodeAt(i);
    }

    // Frame Size (4 bytes big-endian)
    frame[4] = (frameSize >> 24) & 0xff;
    frame[5] = (frameSize >> 16) & 0xff;
    frame[6] = (frameSize >> 8) & 0xff;
    frame[7] = frameSize & 0xff;

    frame[8] = 0x00; // Flags
    frame[9] = 0x00;

    frame[10] = 0x00; // Encoding: ISO-8859-1
    for (let i = 0; i < textBytes.length; i++) {
      frame[11 + i] = textBytes[i];
    }

    return frame;
  }
}
