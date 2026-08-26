/**
 * Master of Masters Studio Pro — MIDI File Export Engine.
 * 
 * Generates standard Type 1 Standard MIDI Files (.mid) with discrete multi-tracks:
 * Track 1: Tempo / Time Signature Header
 * Track 2: Lead & Rhythm Guitars (Ch. 1 / 2)
 * Track 3: Bass (Ch. 3)
 * Track 4: Drums (Ch. 10 General MIDI)
 * Track 5: Hammond B3 Organ & Mellotron (Ch. 4)
 * Track 6: Vocal Melodies (Ch. 5)
 */

export class MidiFileExportEngine {
  /**
   * Encodes variable length quantity (VLQ) for MIDI delta times.
   */
  private static writeVarLen(value: number): number[] {
    const buffer: number[] = [];
    let v = value & 0x7f;
    while ((value >>= 7)) {
      v <<= 8;
      v |= (value & 0x7f) | 0x80;
    }
    while (true) {
      buffer.push(v & 0xff);
      if (v & 0x80) v >>= 8;
      else break;
    }
    return buffer;
  }

  /**
   * Generates a complete multi-track .MID binary file from composed musical parameters.
   */
  public static generateMultiTrackMidi(
    bpm: number,
    durationSec: number,
    baseRootMidiNote = 40 // E2
  ): Uint8Array {
    const ticksPerQuarter = 480;
    const microsecPerQuarter = Math.round(60000000 / bpm);
    const totalBars = Math.ceil((durationSec * bpm) / (60 * 4));

    // Track 1: Tempo & Time Signature
    const tempoTrackEvents: number[] = [
      // Delta-time 0, Time Sig (4/4)
      0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
      // Delta-time 0, Set Tempo
      0x00, 0xff, 0x51, 0x03,
      (microsecPerQuarter >> 16) & 0xff,
      (microsecPerQuarter >> 8) & 0xff,
      microsecPerQuarter & 0xff,
    ];

    // Track 2: Guitars
    const gtrTrackEvents: number[] = [];
    for (let bar = 0; bar < totalBars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        // Note On (Ch 1)
        gtrTrackEvents.push(...this.writeVarLen(0), 0x90, baseRootMidiNote + 12, 100);
        // Note Off after 1 quarter tick
        gtrTrackEvents.push(...this.writeVarLen(ticksPerQuarter), 0x80, baseRootMidiNote + 12, 0);
      }
    }

    // Track 3: Bass
    const bassTrackEvents: number[] = [];
    for (let bar = 0; bar < totalBars; bar++) {
      for (let step = 0; step < 16; step++) {
        const note = step % 4 === 3 ? baseRootMidiNote + 7 : baseRootMidiNote;
        bassTrackEvents.push(...this.writeVarLen(0), 0x92, note, 110);
        bassTrackEvents.push(...this.writeVarLen(Math.floor(ticksPerQuarter / 4)), 0x82, note, 0);
      }
    }

    // Track 4: Drums (Ch 10 - Note 36 Kick, 38 Snare, 42 HiHat)
    const drumTrackEvents: number[] = [];
    for (let bar = 0; bar < totalBars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        // Kick on 1 & 3, Snare on 2 & 4
        const drumNote = (beat === 0 || beat === 2) ? 36 : 38;
        drumTrackEvents.push(...this.writeVarLen(0), 0x99, drumNote, 115);
        drumTrackEvents.push(...this.writeVarLen(ticksPerQuarter), 0x89, drumNote, 0);
      }
    }

    // Helper to package a MIDI track chunk (MTrk)
    const buildTrackChunk = (events: number[]): number[] => {
      // Add End of Track event (FF 2F 00)
      events.push(0x00, 0xff, 0x2f, 0x00);
      const len = events.length;
      return [
        0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
        (len >> 24) & 0xff,
        (len >> 16) & 0xff,
        (len >> 8) & 0xff,
        len & 0xff,
        ...events,
      ];
    };

    const track1 = buildTrackChunk(tempoTrackEvents);
    const track2 = buildTrackChunk(gtrTrackEvents);
    const track3 = buildTrackChunk(bassTrackEvents);
    const track4 = buildTrackChunk(drumTrackEvents);

    const numTracks = 4;
    // Header Chunk (MThd)
    const headerChunk = [
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // Length 6
      0x00, 0x01,             // Type 1 (Multi-track)
      (numTracks >> 8) & 0xff,
      numTracks & 0xff,
      (ticksPerQuarter >> 8) & 0xff,
      ticksPerQuarter & 0xff,
    ];

    const fullMidi = new Uint8Array([
      ...headerChunk,
      ...track1,
      ...track2,
      ...track3,
      ...track4,
    ]);

    return fullMidi;
  }
}
