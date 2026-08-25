import { generateSaturationCurve } from './SaturationCurves';
import { audioBufferTo24BitWavBlob, normalizeBufferToCeiling, calculateBufferStats, type AudioStats } from './WavEncoder';

export type VocalistPresetKey =
  | 'halford'
  | 'dickinson'
  | 'ozzy'
  | 'matos'
  | 'gillen'
  | 'hansen'
  | 'tate'
  | 'meine'
  | 'bach';

export interface VocalistPreset {
  id: VocalistPresetKey;
  name: string;
  artist: string;
  signature: string;
  deEssAmount: number; // 0 to 100
  fetRatio: '4' | '8' | '20' | 'all';
  pultecAirDb: number; // 0 to 12
  doublerWidth: number; // 0 to 100
  reverbDecay: number; // 0.5 to 5.0s
  reverbMix: number; // 0 to 1.0
  eqBands: {
    lowCutHz: number;
    bodyGainDb: number;
    presenceFreqHz: number;
    presenceGainDb: number;
    airGainDb: number;
  };
}

export const VOCALIST_PRESETS: Record<VocalistPresetKey, VocalistPreset> = {
  halford: {
    id: 'halford',
    name: 'Rob Halford',
    artist: 'Judas Priest / Halford',
    signature: 'O "Metal God": agudos penetrantes em 9.5kHz, ataque cortante de 1176 All-Buttons-In e presença ultra-frontal.',
    deEssAmount: 60,
    fetRatio: 'all',
    pultecAirDb: 5.5,
    doublerWidth: 45,
    reverbDecay: 2.2,
    reverbMix: 0.22,
    eqBands: { lowCutHz: 100, bodyGainDb: 1.5, presenceFreqHz: 4000, presenceGainDb: 4.8, airGainDb: 5.5 },
  },
  dickinson: {
    id: 'dickinson',
    name: 'Bruce Dickinson',
    artist: 'Iron Maiden / Solo (Roy Z)',
    signature: '"Air Raid Siren": corpo operático nos médios-graves (250Hz), presença em 3.5kHz e compressão densa de válvula.',
    deEssAmount: 50,
    fetRatio: '8',
    pultecAirDb: 4.0,
    doublerWidth: 55,
    reverbDecay: 2.5,
    reverbMix: 0.28,
    eqBands: { lowCutHz: 90, bodyGainDb: 3.0, presenceFreqHz: 3500, presenceGainDb: 4.2, airGainDb: 4.0 },
  },
  ozzy: {
    id: 'ozzy',
    name: 'Ozzy Osbourne',
    artist: 'Black Sabbath / Solo (Randy Rhoads / Zakk Wylde)',
    signature: 'O Príncipe das Trevas: dobras vocais duplas com slapback analógico de 120ms, pitch detune estéreo e saturação de fita.',
    deEssAmount: 45,
    fetRatio: '4',
    pultecAirDb: 3.5,
    doublerWidth: 85,
    reverbDecay: 2.0,
    reverbMix: 0.35,
    eqBands: { lowCutHz: 110, bodyGainDb: 1.0, presenceFreqHz: 3200, presenceGainDb: 3.8, airGainDb: 3.5 },
  },
  matos: {
    id: 'matos',
    name: 'André Matos',
    artist: 'Angra / Shaman / Viper / Virgo',
    signature: 'O Maestro do Metal Neoclássico: agudos estratosféricos operáticos, pureza harmônica cristalina e ar celestial de 14kHz.',
    deEssAmount: 55,
    fetRatio: '8',
    pultecAirDb: 6.0,
    doublerWidth: 60,
    reverbDecay: 3.0,
    reverbMix: 0.30,
    eqBands: { lowCutHz: 120, bodyGainDb: 2.0, presenceFreqHz: 4200, presenceGainDb: 4.5, airGainDb: 6.0 },
  },
  gillen: {
    id: 'gillen',
    name: 'Ray Gillen',
    artist: 'Badlands / Black Sabbath',
    signature: 'Bluesy Hard Rock Screamer: drive visceral de garganta, médios encorpados e compressão analógica de 1176 rápida.',
    deEssAmount: 40,
    fetRatio: '8',
    pultecAirDb: 3.0,
    doublerWidth: 40,
    reverbDecay: 1.8,
    reverbMix: 0.20,
    eqBands: { lowCutHz: 85, bodyGainDb: 3.5, presenceFreqHz: 2800, presenceGainDb: 4.0, airGainDb: 3.0 },
  },
  hansen: {
    id: 'hansen',
    name: 'Kai Hansen',
    artist: 'Helloween / Gamma Ray',
    signature: 'Speed Metal Screamer: energia alemã de alta velocidade, agudos rasgados e corte afiado que perfura o paredão de guitarras.',
    deEssAmount: 65,
    fetRatio: '20',
    pultecAirDb: 4.8,
    doublerWidth: 70,
    reverbDecay: 2.2,
    reverbMix: 0.24,
    eqBands: { lowCutHz: 115, bodyGainDb: 1.2, presenceFreqHz: 4500, presenceGainDb: 4.8, airGainDb: 4.8 },
  },
  tate: {
    id: 'tate',
    name: 'Geoff Tate',
    artist: 'Queensrÿche (Operation: Mindcrime)',
    signature: 'Profundidade formântica operática: controle dinâmico teatral impecável, ressonâncias dramáticas e reverb de plate de arena.',
    deEssAmount: 50,
    fetRatio: '8',
    pultecAirDb: 4.2,
    doublerWidth: 65,
    reverbDecay: 2.8,
    reverbMix: 0.32,
    eqBands: { lowCutHz: 95, bodyGainDb: 2.8, presenceFreqHz: 3600, presenceGainDb: 4.0, airGainDb: 4.2 },
  },
  meine: {
    id: 'meine',
    name: 'Klaus Meine',
    artist: 'Scorpions',
    signature: 'Voz nasal cortante alemã: agudos brilhantes de 10kHz com inteligibilidade impecável em baladas e rocks de arena.',
    deEssAmount: 55,
    fetRatio: '4',
    pultecAirDb: 4.5,
    doublerWidth: 50,
    reverbDecay: 2.4,
    reverbMix: 0.26,
    eqBands: { lowCutHz: 105, bodyGainDb: 1.8, presenceFreqHz: 3400, presenceGainDb: 3.6, airGainDb: 4.5 },
  },
  bach: {
    id: 'bach',
    name: 'Sebastian Bach',
    artist: 'Skid Row',
    signature: 'O berro juvenil explosivo: alcance de 4 oitavas com dinâmica brutal, saturação valvulada de microfone e ataque imediato.',
    deEssAmount: 50,
    fetRatio: '20',
    pultecAirDb: 5.0,
    doublerWidth: 60,
    reverbDecay: 2.6,
    reverbMix: 0.28,
    eqBands: { lowCutHz: 90, bodyGainDb: 2.5, presenceFreqHz: 3800, presenceGainDb: 4.6, airGainDb: 5.0 },
  },
};

export interface VocalProcessingOptions {
  preset: VocalistPreset;
  customDeEss?: number;
  customAir?: number;
  customDoubler?: number;
  onProgress?: (pct: number, txt: string) => void;
}

export interface VocalResult {
  vocalBuffer: AudioBuffer;
  wavBlob: Blob;
  stats: AudioStats;
  downloadFilename: string;
}

export class VocalEngine {
  /**
   * Processes a vocal audio track with the full Vocal God hardware rack.
   */
  public static async processVocal(
    inputBuffer: AudioBuffer,
    options: VocalProcessingOptions
  ): Promise<VocalResult> {
    const { preset, customDeEss, customAir, customDoubler, onProgress } = options;

    onProgress?.(10, `Calibrando rack vocal para "${preset.name}" (${preset.artist})...`);

    const dur = inputBuffer.duration;
    const sr = inputBuffer.sampleRate;
    const chans = 2; // Always stereo output for doubler/reverb

    const offlineCtx = new OfflineAudioContext(chans, Math.ceil(dur * sr), sr);
    const srcNode = offlineCtx.createBufferSource();
    srcNode.buffer = inputBuffer;

    // 1. Highpass Clean (<90Hz)
    const lowCut = offlineCtx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = preset.eqBands.lowCutHz;
    lowCut.Q.value = 0.7071;

    // 2. Analog De-Esser Notch (6.5kHz narrow sibilance attenuation)
    const deEssAmount = customDeEss !== undefined ? customDeEss : preset.deEssAmount;
    const deEsser = offlineCtx.createBiquadFilter();
    deEsser.type = 'peaking';
    deEsser.frequency.value = 6500;
    deEsser.Q.value = 3.5;
    deEsser.gain.value = -1.0 * (deEssAmount / 100) * 8.0; // up to -8dB cut

    // 3. Body Warmth EQ
    const bodyEq = offlineCtx.createBiquadFilter();
    bodyEq.type = 'peaking';
    bodyEq.frequency.value = 250;
    bodyEq.Q.value = 1.0;
    bodyEq.gain.value = preset.eqBands.bodyGainDb;

    // 4. Vocal Presence Bite EQ (3.5kHz - 4.5kHz)
    const presEq = offlineCtx.createBiquadFilter();
    presEq.type = 'peaking';
    presEq.frequency.value = preset.eqBands.presenceFreqHz;
    presEq.Q.value = 1.1;
    presEq.gain.value = preset.eqBands.presenceGainDb;

    // 5. Pultec Air High Shelf (9.5kHz - 14kHz)
    const airDb = customAir !== undefined ? customAir : preset.pultecAirDb;
    const airEq = offlineCtx.createBiquadFilter();
    airEq.type = 'highshelf';
    airEq.frequency.value = 9500;
    airEq.gain.value = airDb;

    // 6. 1176 FET Vocal Limiter
    const fetComp = offlineCtx.createDynamicsCompressor();
    const ratioVal = preset.fetRatio === 'all' ? 20 : parseInt(preset.fetRatio, 10);
    fetComp.threshold.value = preset.fetRatio === 'all' ? -22 : -17;
    fetComp.ratio.value = ratioVal;
    fetComp.attack.value = 0.002; // 2ms lightning fast FET attack
    fetComp.release.value = 0.08; // 80ms fast recovery
    fetComp.knee.value = preset.fetRatio === 'all' ? 0 : 2;

    // 7. Micro-Pitch Stereo Doubler & Chorus Simulation
    const doublerAmount = customDoubler !== undefined ? customDoubler : preset.doublerWidth;
    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);

    const delayL = offlineCtx.createDelay();
    delayL.delayTime.value = 0.012 * (doublerAmount / 100); // 12ms Left pre-delay

    const delayR = offlineCtx.createDelay();
    delayR.delayTime.value = 0.024 * (doublerAmount / 100); // 24ms Right pre-delay

    // Saturation Tube
    const tubeSat = offlineCtx.createWaveShaper();
    tubeSat.curve = generateSaturationCurve('neve_tube', 0.35);
    tubeSat.oversample = '4x';

    // Master Output Gain
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.90;

    // Connect Chain
    srcNode.connect(lowCut);
    lowCut.connect(deEsser);
    deEsser.connect(bodyEq);
    bodyEq.connect(presEq);
    presEq.connect(airEq);
    airEq.connect(tubeSat);
    tubeSat.connect(fetComp);

    // Doubler split
    fetComp.connect(splitter);
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);

    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);
    fetComp.connect(merger, 0, 0); // Center dry signal
    fetComp.connect(merger, 0, 1);

    merger.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    onProgress?.(55, `Processando 1176 FET e Pultec Air Shelf em 64-bit...`);
    srcNode.start(0);

    const vocalBuffer = await offlineCtx.startRendering();
    normalizeBufferToCeiling(vocalBuffer, -0.2);

    const wavBlob = audioBufferTo24BitWavBlob(vocalBuffer);
    const stats = calculateBufferStats(vocalBuffer);
    const downloadFilename = `VOCAL_GOD_${preset.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_24bit.wav`;

    onProgress?.(100, `✅ Voz Processada com Sucesso no Padrão ${preset.name}!`);

    return {
      vocalBuffer,
      wavBlob,
      stats,
      downloadFilename,
    };
  }
}
