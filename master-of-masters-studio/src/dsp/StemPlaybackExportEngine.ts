/**
 * Master of Masters Studio Pro — Stem & Playback Instrumental Batch Export Engine.
 * 
 * Packages and exports:
 * 1. Full Master Track (24-bit WAV HD)
 * 2. Instrumental / Playback Master (Without Vocals - ready for live shows/karaoke)
 * 3. Isolated Acapella Master (Lead & Harmony Vocals)
 * 4. Individual Mastered Stems (Drums, Bass, Guitars)
 */

import { audioBufferTo24BitWavBlob } from './WavEncoder';

export interface StemPackageBlobs {
  fullMasterBlob: Blob;
  instrumentalBlob?: Blob;
  acapellaBlob?: Blob;
  drumsBlob?: Blob;
  bassBlob?: Blob;
  guitarsBlob?: Blob;
}

export class StemPlaybackExportEngine {
  /**
   * Encodes separated stems to 24-bit WAV blobs.
   */
  public static exportStemPackage(
    fullMaster: AudioBuffer,
    stems?: {
      instrumental?: AudioBuffer;
      acapella?: AudioBuffer;
      drums?: AudioBuffer;
      bass?: AudioBuffer;
      guitars?: AudioBuffer;
    }
  ): StemPackageBlobs {
    const fullMasterBlob = audioBufferTo24BitWavBlob(fullMaster);

    const instrumentalBlob = stems?.instrumental ? audioBufferTo24BitWavBlob(stems.instrumental) : undefined;
    const acapellaBlob = stems?.acapella ? audioBufferTo24BitWavBlob(stems.acapella) : undefined;
    const drumsBlob = stems?.drums ? audioBufferTo24BitWavBlob(stems.drums) : undefined;
    const bassBlob = stems?.bass ? audioBufferTo24BitWavBlob(stems.bass) : undefined;
    const guitarsBlob = stems?.guitars ? audioBufferTo24BitWavBlob(stems.guitars) : undefined;

    return {
      fullMasterBlob,
      instrumentalBlob,
      acapellaBlob,
      drumsBlob,
      bassBlob,
      guitarsBlob
    };
  }
}
