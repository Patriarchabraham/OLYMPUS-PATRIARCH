import { audioBufferTo24BitWavBlob, normalizeBufferToCeiling, calculateBufferStats, type AudioStats } from './WavEncoder';

export interface SpatialNodePos {
  id: string;
  name: string;
  x: number; // -1.0 (left) to +1.0 (right)
  y: number; // 0.0 (front / listener) to 1.0 (back of stage)
  volume: number; // 0.0 to 1.5
  color: string;
}

export interface SpatialPreset {
  id: string;
  name: string;
  description: string;
  nodes: SpatialNodePos[];
}

export const SPATIAL_PRESETS: SpatialPreset[] = [
  {
    id: 'metal_wall',
    name: '⚡ Wall of Sound Heavy Metal',
    description: 'Guitarras 100% L/R nas pontas, Bateria e Baixo no centro frontal com peso e Vocais na cara da mix.',
    nodes: [
      { id: 'drums', name: '🥁 Bateria', x: 0.0, y: 0.25, volume: 1.0, color: '#eab308' },
      { id: 'bass', name: '🎸 Baixo', x: 0.0, y: 0.10, volume: 1.0, color: '#a855f7' },
      { id: 'guitars', name: '⚡ Guitarras', x: -0.85, y: 0.35, volume: 1.1, color: '#f97316' },
      { id: 'vocals', name: '🎤 Voz Lead', x: 0.0, y: 0.05, volume: 1.05, color: '#ef4444' },
      { id: 'synths', name: '🎹 Backings/FX', x: 0.85, y: 0.65, volume: 0.9, color: '#06b6d4' },
    ],
  },
  {
    id: 'stadium_3d',
    name: '🏟️ Palco 3D de Estádio',
    description: 'Ambiência de arena gigante: coros no fundo da sala, guitarras em leque e ambiência aveludada.',
    nodes: [
      { id: 'drums', name: '🥁 Bateria', x: 0.0, y: 0.40, volume: 0.95, color: '#eab308' },
      { id: 'bass', name: '🎸 Baixo', x: -0.15, y: 0.20, volume: 1.0, color: '#a855f7' },
      { id: 'guitars', name: '⚡ Guitarras', x: -0.75, y: 0.45, volume: 1.0, color: '#f97316' },
      { id: 'vocals', name: '🎤 Voz Lead', x: 0.0, y: 0.10, volume: 1.0, color: '#ef4444' },
      { id: 'synths', name: '🎹 Backings/FX', x: 0.75, y: 0.85, volume: 0.95, color: '#06b6d4' },
    ],
  },
  {
    id: 'binaural_studio',
    name: '🎧 Estúdio Binaural Acústico',
    description: 'Dispersão esférica natural com profundidade de sala analógica e separação cirúrgica.',
    nodes: [
      { id: 'drums', name: '🥁 Bateria', x: 0.20, y: 0.30, volume: 0.95, color: '#eab308' },
      { id: 'bass', name: '🎸 Baixo', x: 0.0, y: 0.15, volume: 1.0, color: '#a855f7' },
      { id: 'guitars', name: '⚡ Guitarras', x: -0.60, y: 0.30, volume: 1.0, color: '#f97316' },
      { id: 'vocals', name: '🎤 Voz Lead', x: 0.0, y: 0.05, volume: 1.0, color: '#ef4444' },
      { id: 'synths', name: '🎹 Backings/FX', x: 0.60, y: 0.50, volume: 0.9, color: '#06b6d4' },
    ],
  },
];

export class SpatialEngine {
  /**
   * Renders the 3D spatial positioning and Haas matrix delay for a multitrack mix.
   */
  public static async renderSpatialMix(
    inputBuffer: AudioBuffer,
    nodes: SpatialNodePos[],
    onProgress?: (pct: number, txt: string) => void
  ): Promise<{ spatialBuffer: AudioBuffer; wavBlob: Blob; stats: AudioStats; downloadFilename: string }> {
    onProgress?.(15, 'Configurando matriz de posicionamento estéreo 3D e efeito Haas...');

    const dur = inputBuffer.duration;
    const sr = inputBuffer.sampleRate;
    const chans = 2;

    const offlineCtx = new OfflineAudioContext(chans, Math.ceil(dur * sr), sr);
    const srcNode = offlineCtx.createBufferSource();
    srcNode.buffer = inputBuffer;

    const masterMerger = offlineCtx.createChannelMerger(2);

    // For each spatial node, create a panning + Haas delay + distance attenuation bus
    nodes.forEach((node) => {
      // Pan calculation: -1 (left) to +1 (right)
      const panL = Math.cos(((node.x + 1) * Math.PI) / 4);
      const panR = Math.sin(((node.x + 1) * Math.PI) / 4);

      // Distance attenuation (1.0 at front y=0, down to 0.65 at back y=1)
      const distGain = (1.0 - node.y * 0.35) * node.volume;

      // Haas delay (0ms up to 25ms based on depth)
      const haasDelayL = offlineCtx.createDelay();
      const haasDelayR = offlineCtx.createDelay();
      haasDelayL.delayTime.value = node.x > 0 ? (node.x * 0.015) : 0.001;
      haasDelayR.delayTime.value = node.x < 0 ? (Math.abs(node.x) * 0.015) : 0.001;

      const gainL = offlineCtx.createGain();
      gainL.gain.value = panL * distGain;

      const gainR = offlineCtx.createGain();
      gainR.gain.value = panR * distGain;

      srcNode.connect(gainL);
      srcNode.connect(gainR);

      gainL.connect(haasDelayL);
      gainR.connect(haasDelayR);

      haasDelayL.connect(masterMerger, 0, 0);
      haasDelayR.connect(masterMerger, 0, 1);
    });

    const finalGain = offlineCtx.createGain();
    finalGain.gain.value = 0.85;
    masterMerger.connect(finalGain);
    finalGain.connect(offlineCtx.destination);

    onProgress?.(60, 'Renderizando posicionamento 3D imersivo em 24-bit HD...');
    srcNode.start(0);

    const spatialBuffer = await offlineCtx.startRendering();
    normalizeBufferToCeiling(spatialBuffer, -0.2);

    const wavBlob = audioBufferTo24BitWavBlob(spatialBuffer);
    const stats = calculateBufferStats(spatialBuffer);
    const downloadFilename = `SPATIAL_3D_MASTER_24bit.wav`;

    onProgress?.(100, '✅ Mixagem Espacial 3D Concluída com Sucesso!');

    return {
      spatialBuffer,
      wavBlob,
      stats,
      downloadFilename,
    };
  }
}
