/**
 * Master of Masters Studio Pro — Core Quantum Supreme Audio Processing Engine.
 * Multi-layer Stem Separation, AI Spectral Diagnosis, 512-Band Historical Matcher,
 * Dynamic Resonance Suppressor (Soothe/Gullfoss), Smart Kick/Bass Unmasker,
 * Transient Punch Sculptor, Transformer Hysteresis, 4-Band Holographic Spatializer,
 * Real-World Device Simulation, and Streaming Targets.
 */

import { type MasterAlbumSetup, type MasterProducer } from '../database/masters-database';
import { generateSaturationCurve } from './SaturationCurves';
import {
  audioBufferTo24BitWavBlob,
  audioBufferTo32BitFloatWavBlob,
  calculateBufferStats,
  type AudioStats,
} from './WavEncoder';
import { UniversalStemSeparationEngine } from './UniversalStemSeparationEngine';
import { SpectralClonerEngine } from './SpectralClonerEngine';
import { AiMasterAssistant, type TrackDiagnostic } from './AiMasterAssistant';
import { AnalogTapeTransformerEngine, type AnalogColorModel } from './AnalogTapeTransformerEngine';
import { HolographicSpatialEngine } from './HolographicSpatialEngine';
import { StreamingTargetEngine, type StreamingPlatform } from './StreamingTargetEngine';
import { BatchExportReportEngine } from './BatchExportReportEngine';
import { DynamicResonanceSuppressor } from './DynamicResonanceSuppressor';
import { SmartKickBassUnmasker } from './SmartKickBassUnmasker';
import { TransientPunchSculptor } from './TransientPunchSculptor';
import { RealWorldDeviceSimulator, type RealWorldDevice } from './RealWorldDeviceSimulator';
import { DolbyAtmosBinauralRoom } from './DolbyAtmosBinauralRoom';

export interface ProcessMasterOptions {
  album: MasterAlbumSetup;
  producer?: MasterProducer;
  intensityScale?: number;
  customDrive?: number;
  customWidth?: number;
  drumReplacementBlend?: number;
  guitarReampBlend?: number;
  bassReampBlend?: number;
  vocalModelBlend?: number;
  harmonyOptions?: any;
  pitchOptions?: any;
  targetCeilingDb?: number;
  bitDepth?: '24bit' | '32bit';
  streamingPlatform?: StreamingPlatform;
  analogColorModel?: AnalogColorModel;
  enableAiAssistant?: boolean;
  enableDynamicDeHarsh?: boolean;
  enableKickBassUnmask?: boolean;
  transientPunchAmount?: number;
  realWorldDevice?: RealWorldDevice;
  enableDolbyAtmosRoom?: boolean;
  onProgress?: (percent: number, status: string) => void;
}

export interface MasterResult {
  masterBuffer: AudioBuffer;
  wavBlob: Blob;
  stats: AudioStats;
  downloadFilename: string;
  diagnostic?: TrackDiagnostic;
  reportHtml: string;
}

export class AudioEngine {
  /**
   * Main Master of Masters Quantum Supreme Audio Pipeline.
   */
  public static async processMaster(
    inputBuffer: AudioBuffer,
    options: ProcessMasterOptions
  ): Promise<MasterResult> {
    const {
      album,
      producer,
      intensityScale = 1.0,
      customDrive,
      customWidth,
      drumReplacementBlend = 0.65,
      guitarReampBlend = 0.65,
      bassReampBlend = 0.65,
      vocalModelBlend = 0.65,
      harmonyOptions = {},
      pitchOptions = { enabled: false, rootKey: 'C', scale: 'chromatic', retuneSpeed: 0.65, amount: 0.80 },
      bitDepth = '24bit',
      streamingPlatform = 'cd_metal',
      analogColorModel = 'ampex_atr102',
      enableAiAssistant = true,
      enableDynamicDeHarsh = true,
      enableKickBassUnmask = true,
      transientPunchAmount = 0.45,
      realWorldDevice = 'flat_studio',
      enableDolbyAtmosRoom = false,
      onProgress,
    } = options;

    const sr = inputBuffer.sampleRate;
    const length = inputBuffer.length;

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 0: AI MASTER ASSISTANT 2.0 (SPECTRAL DIAGNOSTIC & PRE-CONDITIONING)
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(5, '🧠 Analisando balanço espectral com AI Master Assistant 2.0...');
    let activeInputBuffer = inputBuffer;
    let diagnostic: TrackDiagnostic | undefined;

    if (enableAiAssistant) {
      diagnostic = AiMasterAssistant.diagnoseTrack(inputBuffer);
      activeInputBuffer = await AiMasterAssistant.applyPreCorrections(inputBuffer, diagnostic);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: DYNAMIC 10-LAYER MULTI-INSTRUMENT SEPARATION & PRE-WELDING
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(15, `Separando e refinando 10 camadas de instrumentos para "${album.band} - ${album.albumTitle}"...`);
    const weldedStemBuffer = await UniversalStemSeparationEngine.processAndWeld10Layers(
      new OfflineAudioContext(2, length, sr),
      activeInputBuffer,
      album,
      intensityScale,
      drumReplacementBlend,
      guitarReampBlend,
      bassReampBlend,
      vocalModelBlend,
      harmonyOptions,
      pitchOptions
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2: 512-BAND SPECTRAL CLONING DIRECT FROM PRODUCER & ALBUM
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(28, `Clonando curva espectral analógica de 512 bandas do álbum "${album.albumTitle}"...`);
    const clonedL = weldedStemBuffer.getChannelData(0);
    const clonedR = weldedStemBuffer.numberOfChannels > 1 ? weldedStemBuffer.getChannelData(1) : clonedL;
    const spectralMatched = SpectralClonerEngine.processSpectralCloning(
      clonedL,
      clonedR,
      album,
      intensityScale,
      sr
    );
    weldedStemBuffer.copyToChannel(spectralMatched.left, 0);
    weldedStemBuffer.copyToChannel(spectralMatched.right, 1);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 3: SMART KICK & BASS UNMASKING + DYNAMIC RESONANCE SUPPRESSOR (SOOTHE)
    // ─────────────────────────────────────────────────────────────────────────
    if (enableKickBassUnmask || enableDynamicDeHarsh) {
      onProgress?.(38, '🌊 Suprimindo ressonâncias dinâmicas (Soothe/Gullfoss) e desmascarando Bumbo/Baixo...');
      let lChan = weldedStemBuffer.getChannelData(0);
      let rChan = weldedStemBuffer.getChannelData(1);

      if (enableKickBassUnmask) {
        const unmasked = SmartKickBassUnmasker.processUnmask(lChan, rChan, 0.55 * intensityScale, sr);
        lChan = unmasked.left;
        rChan = unmasked.right;
      }

      if (enableDynamicDeHarsh) {
        const deHarshed = DynamicResonanceSuppressor.processAdaptiveDeHarsh(lChan, rChan, 0.60 * intensityScale, sr);
        lChan = deHarshed.left;
        rChan = deHarshed.right;
      }

      weldedStemBuffer.copyToChannel(lChan, 0);
      weldedStemBuffer.copyToChannel(rChan, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 4: TRANSIENT PUNCH & ATTACK SCULPTING
    // ─────────────────────────────────────────────────────────────────────────
    if (transientPunchAmount > 0.05) {
      onProgress?.(45, '🥊 Esculpindo ataque de transientes e punch de bateria/guitarras...');
      const lChan = weldedStemBuffer.getChannelData(0);
      const rChan = weldedStemBuffer.getChannelData(1);
      const punchResult = TransientPunchSculptor.processTransientPunch(lChan, rChan, transientPunchAmount * intensityScale, sr);
      weldedStemBuffer.copyToChannel(punchResult.left, 0);
      weldedStemBuffer.copyToChannel(punchResult.right, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 5: ANALOG TAPE & TRANSFORMER HYSTERESIS MODELING
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(52, `Injetando saturação de fita analógica e transformadores (${analogColorModel.toUpperCase()})...`);
    const tapeL = weldedStemBuffer.getChannelData(0);
    const tapeR = weldedStemBuffer.getChannelData(1);
    const tapeDrive = customDrive !== undefined ? customDrive : album.saturation.drive || 0.45;
    const tapeProcessed = AnalogTapeTransformerEngine.processAnalogColor(
      tapeL,
      tapeR,
      analogColorModel,
      tapeDrive * intensityScale,
      sr
    );
    weldedStemBuffer.copyToChannel(tapeProcessed.left, 0);
    weldedStemBuffer.copyToChannel(tapeProcessed.right, 1);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 6: CONSOLE MASTERING EQ & SSL G-BUS GLUE COMPRESSOR
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(65, `Processando console analógico SSL G-Bus e EQ de 10 bandas...`);
    const masterCtx = new OfflineAudioContext(2, length, sr);
    const src = masterCtx.createBufferSource();
    src.buffer = weldedStemBuffer;

    const inputPad = masterCtx.createGain();
    inputPad.gain.value = 0.75; // -2.5dB sweet-spot headroom

    const subHp = masterCtx.createBiquadFilter();
    subHp.type = 'highpass';
    subHp.frequency.value = 30;
    subHp.Q.value = 0.7071;

    const tuningResonance = masterCtx.createBiquadFilter();
    tuningResonance.type = 'peaking';
    tuningResonance.frequency.value = album.tuningSignature?.harmonicResonanceCenterHz || 82.41;
    tuningResonance.Q.value = 1.4;
    tuningResonance.gain.value = 0.5 * intensityScale;

    // 10-Band Precision EQ
    const eq = album.eq10Band;
    const eqScale = 0.30 * intensityScale;
    const f30 = masterCtx.createBiquadFilter(); f30.type = 'lowshelf'; f30.frequency.value = 35; f30.gain.value = eq.hz30 * eqScale;
    const f60 = masterCtx.createBiquadFilter(); f60.type = 'peaking'; f60.frequency.value = 60; f60.Q.value = 1.0; f60.gain.value = eq.hz60 * eqScale;
    const f120 = masterCtx.createBiquadFilter(); f120.type = 'peaking'; f120.frequency.value = 120; f120.Q.value = 1.0; f120.gain.value = eq.hz120 * eqScale;
    const f250 = masterCtx.createBiquadFilter(); f250.type = 'peaking'; f250.frequency.value = 250; f250.Q.value = 1.0; f250.gain.value = eq.hz250 * eqScale;
    const f500 = masterCtx.createBiquadFilter(); f500.type = 'peaking'; f500.frequency.value = 500; f500.Q.value = 1.0; f500.gain.value = eq.hz500 * eqScale;
    const f1000 = masterCtx.createBiquadFilter(); f1000.type = 'peaking'; f1000.frequency.value = 1000; f1000.Q.value = 1.0; f1000.gain.value = eq.hz1000 * eqScale;
    const f2500 = masterCtx.createBiquadFilter(); f2500.type = 'peaking'; f2500.frequency.value = 2500; f2500.Q.value = 1.0; f2500.gain.value = eq.hz2500 * eqScale;
    const f4000 = masterCtx.createBiquadFilter(); f4000.type = 'peaking'; f4000.frequency.value = 4000; f4000.Q.value = 1.0; f4000.gain.value = eq.hz4000 * eqScale;
    const f8000 = masterCtx.createBiquadFilter(); f8000.type = 'peaking'; f8000.frequency.value = 8000; f8000.Q.value = 0.9; f8000.gain.value = eq.hz8000 * eqScale;
    const f16000 = masterCtx.createBiquadFilter(); f16000.type = 'highshelf'; f16000.frequency.value = 14000; f16000.gain.value = eq.hz16000 * eqScale;

    src.connect(inputPad);
    inputPad.connect(subHp);
    subHp.connect(tuningResonance);
    tuningResonance.connect(f30);
    f30.connect(f60);
    f60.connect(f120);
    f120.connect(f250);
    f250.connect(f500);
    f500.connect(f1000);
    f1000.connect(f2500);
    f2500.connect(f4000);
    f4000.connect(f8000);
    f8000.connect(f16000);

    const satNode = masterCtx.createWaveShaper();
    const targetDrive = Math.min(0.20, (customDrive !== undefined ? customDrive : album.saturation.drive) * 0.20);
    satNode.curve = generateSaturationCurve(album.saturation.type, targetDrive);
    satNode.oversample = '4x';
    f16000.connect(satNode);

    const compNode = masterCtx.createDynamicsCompressor();
    compNode.threshold.value = Math.max(-18, album.compressor.threshold || -14);
    compNode.ratio.value = Math.min(2.5, album.compressor.ratio || 2.0);
    compNode.attack.value = Math.max(0.030, (album.compressor.attack || 30) / 1000);
    compNode.release.value = Math.max(0.100, (album.compressor.release || 100) / 1000);
    compNode.knee.value = 8;
    satNode.connect(compNode);

    const masterGain = masterCtx.createGain();
    masterGain.gain.value = 1.05;
    compNode.connect(masterGain);
    masterGain.connect(masterCtx.destination);
    src.start(0);

    const renderedMaster = await masterCtx.startRendering();

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 7: 4-BAND HOLOGRAPHIC 3D MID/SIDE SPATIALIZER
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(80, 'Ajustando imagem 3D holográfica e travando mono sub-bass (<90Hz)...');
    const width = customWidth !== undefined ? customWidth : album.stereoWidth || 1.35;
    const lRendered = renderedMaster.getChannelData(0);
    const rRendered = renderedMaster.getChannelData(1);
    const spatialResult = HolographicSpatialEngine.processHolographicWidth(
      lRendered,
      rRendered,
      width,
      sr
    );
    renderedMaster.copyToChannel(spatialResult.left, 0);
    renderedMaster.copyToChannel(spatialResult.right, 1);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 8: OPTIONAL DOLBY ATMOS 7.1.4 BINAURAL ROOM / REAL-WORLD SIMULATION
    // ─────────────────────────────────────────────────────────────────────────
    if (enableDolbyAtmosRoom) {
      onProgress?.(85, '🏰 Renderizando simulação acústica de sala Dolby Atmos 7.1.4...');
      const lAtm = renderedMaster.getChannelData(0);
      const rAtm = renderedMaster.getChannelData(1);
      const atmosResult = DolbyAtmosBinauralRoom.processBinauralRoom(lAtm, rAtm, true, sr);
      renderedMaster.copyToChannel(atmosResult.left, 0);
      renderedMaster.copyToChannel(atmosResult.right, 1);
    }

    if (realWorldDevice !== 'flat_studio') {
      onProgress?.(87, `📱 Aplicando simulação acústica de dispositivo (${realWorldDevice.toUpperCase()})...`);
      const lDev = renderedMaster.getChannelData(0);
      const rDev = renderedMaster.getChannelData(1);
      const devResult = RealWorldDeviceSimulator.processDeviceSimulation(lDev, rDev, realWorldDevice, sr);
      renderedMaster.copyToChannel(devResult.left, 0);
      renderedMaster.copyToChannel(devResult.right, 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 9: STREAMING TARGET CALIBRATION & BRICKWALL TRUE-PEAK LIMITER
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(90, `Calibrando alvo para ${streamingPlatform.toUpperCase()} e limitando True-Peak...`);
    StreamingTargetEngine.matchPlatformSpecs(renderedMaster, streamingPlatform);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 10: AUDIO ENCODING & MASTERING ENGINEERING REPORT
    // ─────────────────────────────────────────────────────────────────────────
    onProgress?.(95, `Codificando WAV ${bitDepth === '24bit' ? '24-Bit HD com Dither TPDF' : '32-Bit Float'} e gerando relatório técnico...`);
    const wavBlob =
      bitDepth === '24bit'
        ? audioBufferTo24BitWavBlob(renderedMaster)
        : audioBufferTo32BitFloatWavBlob(renderedMaster);

    const stats = calculateBufferStats(renderedMaster);
    const cleanAlbum = album.albumTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFilename = `MASTER_${album.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanAlbum}_24bit.wav`;

    const reportHtml = BatchExportReportEngine.generateHtmlReport(
      stats,
      album,
      producer,
      album.albumTitle
    );

    onProgress?.(100, `✅ Masterização Quântica Analógica Concluída com Excelência! (${album.albumTitle})`);

    return {
      masterBuffer: renderedMaster,
      wavBlob,
      stats,
      downloadFilename,
      diagnostic,
      reportHtml,
    };
  }
}

export { AudioEngine as MasteringEngine, type MasterResult as MasteringResult };
