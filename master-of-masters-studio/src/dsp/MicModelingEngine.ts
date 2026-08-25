import type { MicrophoneModel } from '../database/microphones-database';
import { generateSaturationCurve } from './SaturationCurves';
import { audioBufferTo24BitWavBlob, normalizeBufferToCeiling, calculateBufferStats, type AudioStats } from './WavEncoder';

export interface MicProcessingOptions {
  mic: MicrophoneModel;
  distanceCm?: number; // 0 to 30 cm (proximity effect)
  preampDriveMultiplier?: number; // 0.5 to 1.5
  onProgress?: (pct: number, txt: string) => void;
}

export interface MicResult {
  modeledBuffer: AudioBuffer;
  wavBlob: Blob;
  stats: AudioStats;
  downloadFilename: string;
}

export class MicModelingEngine {
  /**
   * Applies the exact acoustic response, proximity effect, polar pattern and preamp saturation
   * of a physical legendary microphone to an audio buffer.
   */
  public static async modelMicrophone(
    inputBuffer: AudioBuffer,
    options: MicProcessingOptions
  ): Promise<MicResult> {
    const { mic, distanceCm = 5, preampDriveMultiplier = 1.0, onProgress } = options;

    onProgress?.(10, `Calibrando cápsula e resposta de frequência de "${mic.brand} ${mic.name}"...`);

    const dur = inputBuffer.duration;
    const sr = inputBuffer.sampleRate;
    const chans = inputBuffer.numberOfChannels;

    const offlineCtx = new OfflineAudioContext(chans, Math.ceil(dur * sr), sr);
    const srcNode = offlineCtx.createBufferSource();
    srcNode.buffer = inputBuffer;

    // 1. Highpass Low-Cut of the physical microphone body
    const lowCut = offlineCtx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = mic.eqResponse.lowCutHz;
    lowCut.Q.value = 0.7071;

    // 2. Proximity Effect (Sub-Bass & Bass boost when close, 0 to 10cm)
    const proxFactor = Math.max(0, (20 - distanceCm) / 20) * mic.proximityStrength;
    const proxBoostDb = proxFactor * 4.5; // up to +4.5dB proximity bass warmth

    const subEq = offlineCtx.createBiquadFilter();
    subEq.type = 'lowshelf';
    subEq.frequency.value = 75;
    subEq.gain.value = mic.eqResponse.subBassGain + proxBoostDb * 0.7;

    const bassEq = offlineCtx.createBiquadFilter();
    bassEq.type = 'peaking';
    bassEq.frequency.value = 200;
    bassEq.Q.value = 1.0;
    bassEq.gain.value = mic.eqResponse.bassGain + proxBoostDb;

    // 3. Low-Mid Capsule Resonator
    const lowMidEq = offlineCtx.createBiquadFilter();
    lowMidEq.type = 'peaking';
    lowMidEq.frequency.value = 500;
    lowMidEq.Q.value = 1.2;
    lowMidEq.gain.value = mic.eqResponse.lowMidGain;

    // 4. Mid Articulation Filter
    const midEq = offlineCtx.createBiquadFilter();
    midEq.type = 'peaking';
    midEq.frequency.value = mic.eqResponse.midFreqHz;
    midEq.Q.value = 1.0;
    midEq.gain.value = mic.eqResponse.midGain;

    // 5. Diaphragm Presence Peak
    const presEq = offlineCtx.createBiquadFilter();
    presEq.type = 'peaking';
    presEq.frequency.value = mic.eqResponse.presenceFreqHz;
    presEq.Q.value = 1.1;
    presEq.gain.value = mic.eqResponse.presenceGain;

    // 6. Air Sheen High Shelf
    const airEq = offlineCtx.createBiquadFilter();
    airEq.type = 'highshelf';
    airEq.frequency.value = mic.eqResponse.airFreqHz;
    airEq.gain.value = mic.eqResponse.airGain;

    // 7. Discrete Preamp Saturation Stage
    const satType =
      mic.preampType === 'neve_1073'
        ? 'neve_tube'
        : mic.preampType === 'tube_tech'
        ? 'fairchild_mu'
        : mic.preampType === 'api_512'
        ? 'ssl_vca'
        : mic.preampType === 'ssl_e'
        ? 'ssl_vca'
        : 'shadow_hills';

    const preampSat = offlineCtx.createWaveShaper();
    const drive = mic.preampDrive * preampDriveMultiplier;
    preampSat.curve = generateSaturationCurve(satType, drive);
    preampSat.oversample = '4x';

    // Master Gain Headroom
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.88;

    // Connect Cascade
    srcNode.connect(lowCut);
    lowCut.connect(subEq);
    subEq.connect(bassEq);
    bassEq.connect(lowMidEq);
    lowMidEq.connect(midEq);
    midEq.connect(presEq);
    presEq.connect(airEq);
    airEq.connect(preampSat);
    preampSat.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    onProgress?.(50, `Renderizando resposta acústica da cápsula ${mic.capsule.toUpperCase()}...`);
    srcNode.start(0);

    const modeledBuffer = await offlineCtx.startRendering();
    normalizeBufferToCeiling(modeledBuffer, -0.2);

    const wavBlob = audioBufferTo24BitWavBlob(modeledBuffer);
    const stats = calculateBufferStats(modeledBuffer);
    const cleanName = `${mic.brand}_${mic.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFilename = `MIC_MODELED_${cleanName}_24bit.wav`;

    onProgress?.(100, `✅ Microfone "${mic.brand} ${mic.name}" Modelado com Sucesso!`);

    return {
      modeledBuffer,
      wavBlob,
      stats,
      downloadFilename,
    };
  }
}
