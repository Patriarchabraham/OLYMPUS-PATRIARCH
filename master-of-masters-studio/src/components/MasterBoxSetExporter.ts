/**
 * Master of Masters Studio Pro — 1-Click Master Box Set Exporter.
 * 
 * Exports the complete production package:
 * 1. Master Audio WAV 24-bit HD
 * 2. 4 Multi-track Stems in separate WAV files (Drums, Bass, Guitars, Vocals)
 * 3. MIDI 2.0 Multi-track File (.mid)
 * 4. Maestro Conductor Score & Tabs (.txt)
 */

import { AudioBufferHelper } from '../dsp/AudioBufferHelper';
import { MidiFileExportEngine } from '../dsp/MidiFileExportEngine';

export class MasterBoxSetExporter {
  /**
   * Downloads a specific AudioBuffer as a 24-bit WAV file.
   */
  public static downloadBufferAsWav(
    buffer: AudioBuffer,
    filename: string
  ): void {
    const wavBlob = AudioBufferHelper.audioBufferToWavBlob(buffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Triggers the 1-Click Box Set sequential download of all assets.
   */
  public static exportFullBoxSet(
    masterBuffer: AudioBuffer,
    stems: { drums: AudioBuffer; bass: AudioBuffer; guitars: AudioBuffer; vocals: AudioBuffer } | null,
    baseName: string,
    scoreText: string
  ): void {
    // 1. Master WAV
    this.downloadBufferAsWav(masterBuffer, `${baseName}_01_MASTER_24BIT.wav`);

    // 2. Multi-track Stems (if available)
    if (stems) {
      setTimeout(() => this.downloadBufferAsWav(stems.drums, `${baseName}_STEM_DRUMS.wav`), 500);
      setTimeout(() => this.downloadBufferAsWav(stems.bass, `${baseName}_STEM_BASS.wav`), 1000);
      setTimeout(() => this.downloadBufferAsWav(stems.guitars, `${baseName}_STEM_GUITARS.wav`), 1500);
      setTimeout(() => this.downloadBufferAsWav(stems.vocals, `${baseName}_STEM_VOCALS.wav`), 2000);
    }

    // 3. MIDI File
    setTimeout(() => {
      const midiBytes = MidiFileExportEngine.generateMultiTrackMidi(145, masterBuffer.duration, 40);
      const midiBlob = new Blob([midiBytes], { type: 'audio/midi' });
      const url = URL.createObjectURL(midiBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_MULTI_TRACK.mid`;
      a.click();
    }, 2500);

    // 4. Score Text
    setTimeout(() => {
      const scoreBlob = new Blob([scoreText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(scoreBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_PARTITURA_MAESTRO.txt`;
      a.click();
    }, 3000);
  }
}
