import './style.css';
import {
  ALL_MASTERS,
  type MasterProducer,
  type MasterAlbumSetup,
} from './database/masters-database';
import {
  LEGENDARY_MICROPHONES,
  type MicrophoneModel,
  type MicCategory,
} from './database/microphones-database';
import { MasteringEngine, type MasteringResult } from './dsp/AudioEngine';
import { GemWelderEngine, type WelderResult } from './dsp/GemWelderEngine';
import { VocalEngine, VOCALIST_PRESETS, type VocalistPresetKey } from './dsp/VocalEngine';
import { SpatialEngine, SPATIAL_PRESETS, type SpatialNodePos } from './dsp/SpatialEngine';
import { AiMatchEngine } from './dsp/AiMatchEngine';
import { MicModelingEngine } from './dsp/MicModelingEngine';
import { RotaryKnob } from './components/RotaryKnob';
import { SpectrumVisualizer } from './visualizers/SpectrumAnalyzer';
import { PhaseGoniometer } from './visualizers/PhaseGoniometer';
import { AnalogVuMeter } from './visualizers/VuMeter';
import { StereoPeakMeter } from './visualizers/PeakMeter';
import { MasteringReport } from './components/MasteringReport';
import { PresetManager } from './components/PresetManager';
import { MultiFormatEncoder } from './dsp/MultiFormatEncoder';
import { BinauralStudioMonitor } from './dsp/BinauralStudioMonitor';
import { SongArrangerEngine, type SongSection } from './dsp/SongArrangerEngine';
import { KeyDetectorEngine } from './dsp/KeyDetectorEngine';
import { VoiceTimbreCloner } from './dsp/VoiceTimbreCloner';
import { GainMatchedAbEngine } from './dsp/GainMatchedAbEngine';
import { ReactiveTubeVisualizer } from './visualizers/ReactiveTubeVisualizer';
import { InteractiveCurveSculptor } from './visualizers/InteractiveCurveSculptor';
import { WaveformScrubber } from './components/WaveformScrubber';
import { LiveRigAuditionEngine } from './dsp/LiveRigAuditionEngine';
import { ReleaseBundleExportEngine, type ReleaseFileItem } from './dsp/ReleaseBundleExportEngine';
import { VocalChoirHarmonizerEngine } from './dsp/VocalChoirHarmonizerEngine';
import { AnsiVuMeterBallistics } from './visualizers/AnsiVuMeterBallistics';
import { Mp3EncoderEngine } from './dsp/Mp3EncoderEngine';
import { MasteringRadarBenchmark } from './visualizers/MasteringRadarBenchmark';
import { ProKeybindingsMatrix } from './components/ProKeybindingsMatrix';
import { AiReferenceTrackMatcher, type ReferenceTrackProfile } from './dsp/AiReferenceTrackMatcher';
import { DeHummerGroundCleaner } from './dsp/DeHummerGroundCleaner';
import { CoverArtGenerator } from './components/CoverArtGenerator';
import { AiMasterCoPilotEngine } from './dsp/AiMasterCoPilotEngine';
import { DolbyAtmos3DSphereVisualizer } from './visualizers/DolbyAtmos3DSphereVisualizer';
import { StemSpecificReferenceMatcher } from './dsp/StemSpecificReferenceMatcher';
import { WaterfallSpectrogramVisualizer } from './visualizers/WaterfallSpectrogramVisualizer';
import { PerceptualLoudnessMatcher } from './dsp/PerceptualLoudnessMatcher';
import { SpectralClonerEngine2048 } from './dsp/SpectralClonerEngine2048';
import { AiMasterAutoCalibrator } from './dsp/AiMasterAutoCalibrator';
import { MasteringStandardsCompliance } from './components/MasteringStandardsCompliance';
import { SocialVideoTeaserGenerator } from './components/SocialVideoTeaserGenerator';
import { PresetBackupRestoreManager } from './components/PresetBackupRestoreManager';
import { AlbumBatchMasterEngine, type AlbumTrackItem } from './dsp/AlbumBatchMasterEngine';

// ─── STATE ───────────────────────────────────────────────────────────────────
let activeProducer: MasterProducer = ALL_MASTERS[0];
let activeAlbum: MasterAlbumSetup = ALL_MASTERS[0].albums[0];
let activeMic: MicrophoneModel = LEGENDARY_MICROPHONES[0];

let loadedFile: File | null = null;
let audioBuffer: AudioBuffer | null = null;
let audioCtx: AudioContext | null = null;

let lastMasterResult: MasteringResult | null = null;
let lastWelderResult: WelderResult | null = null;

let vocalBuffer: AudioBuffer | null = null;
let aiTargetBuffer: AudioBuffer | null = null;
let aiRefBuffer: AudioBuffer | null = null;

let spatialNodes: SpatialNodePos[] = JSON.parse(JSON.stringify(SPATIAL_PRESETS[0].nodes));
let draggedNodeId: string | null = null;

let spectrumVisualizer: SpectrumVisualizer;
let phaseGoniometer: PhaseGoniometer;
let vuMeter: AnalogVuMeter;
let vuMeterSec: AnalogVuMeter;
let stereoPeakMeter: StereoPeakMeter;

let playbackAudioCtx: AudioContext | null = null;
let playbackSourceNode: MediaElementAudioSourceNode | null = null;
let analyserL: AnalyserNode;
let analyserR: AnalyserNode;
let playbackDataL: Float32Array;
let playbackDataR: Float32Array;
let isPeakMeterRunning = false;

let batchFiles: File[] = [];
let isMono = false;
let isDim = false;

// ─── DOM ELEMENTS ────────────────────────────────────────────────────────────
const producerCardsContainer = document.getElementById('producer-cards-container')!;
const filterBtns = document.querySelectorAll('.filter-btn') as NodeListOf<HTMLButtonElement>;
const selectProducerQuick = document.getElementById('select-producer-quick') as HTMLSelectElement;
const selectAlbumQuick = document.getElementById('select-album-quick') as HTMLSelectElement;
const btnToggleProducersDrawer = document.getElementById('btn-toggle-producers-drawer') as HTMLButtonElement;
const producersDrawerPanel = document.getElementById('producers-drawer-panel')!;

const activeMasterTag = document.getElementById('active-master-tag')!;
const activeEraTag = document.getElementById('active-era-tag')!;
const activeAlbumTitle = document.getElementById('active-album-title')!;
const activeCountryText = document.getElementById('active-country-text')!;
const specTuning = document.getElementById('spec-tuning')!;
const specGuitarAmp = document.getElementById('spec-guitar-amp')!;
const specLufs = document.getElementById('spec-lufs')!;
const specSat = document.getElementById('spec-sat')!;
const specComp = document.getElementById('spec-comp')!;
const specWidth = document.getElementById('spec-width')!;
const specChain = document.getElementById('spec-chain')!;

// Sliders (Fallback & Rotary Sync)
const sliderSat = document.getElementById('slider-sat') as HTMLInputElement;
const sliderWidth = document.getElementById('slider-width') as HTMLInputElement;
const sliderIntensity = document.getElementById('slider-intensity') as HTMLInputElement;
const labelSatVal = document.getElementById('label-sat-val')!;
const labelWidthVal = document.getElementById('label-width-val')!;
const labelIntensityVal = document.getElementById('label-intensity-val')!;

// Audio Loader & Player Dock
const audioDropzone = document.getElementById('audio-dropzone')!;
const audioFileInput = document.getElementById('audio-file-input') as HTMLInputElement;
const dropIdleState = document.getElementById('drop-idle-state')!;
const dropActiveState = document.getElementById('drop-active-state')!;
const loadedFileName = document.getElementById('loaded-file-name')!;
const loadedFileStats = document.getElementById('loaded-file-stats')!;
const mainAudioPlayer = document.getElementById('main-audio-player') as HTMLAudioElement;
const btnTransportPlay = document.getElementById('btn-transport-play') as HTMLButtonElement;
const transportScrub = document.getElementById('transport-scrub') as HTMLInputElement;
const transportTimeCurrent = document.getElementById('transport-time-current')!;
const transportTimeTotal = document.getElementById('transport-time-total')!;
const btnAbOrig = document.getElementById('btn-ab-orig') as HTMLButtonElement;
const btnAbMaster = document.getElementById('btn-ab-master') as HTMLButtonElement;
const btnMonoCheck = document.getElementById('btn-mono-check') as HTMLButtonElement;
const btnDim = document.getElementById('btn-dim') as HTMLButtonElement;

// Process Master
const btnProcessMaster = document.getElementById('btn-process-master') as HTMLButtonElement;
const btnDownloadMaster = document.getElementById('btn-download-master') as HTMLAnchorElement;
const masterProgressWrap = document.getElementById('master-progress-wrap')!;
const masterProgressBar = document.getElementById('master-progress-bar')!;
const masterProgressPct = document.getElementById('master-progress-pct')!;
const masterProgressText = document.getElementById('master-progress-text')!;
const masterTubeFilament = document.getElementById('master-tube-filament')!;

// Welder & Instrument Customizers
const selectDrummerPreset = document.getElementById('select-drummer-preset') as HTMLSelectElement;
const selectDrumSaturation = document.getElementById('select-drum-saturation') as HTMLSelectElement;
const sliderDrumDrive = document.getElementById('slider-drum-drive') as HTMLInputElement;
const labelDrumDrive = document.getElementById('label-drum-drive')!;
const drumSaturationDesc = document.getElementById('drum-saturation-desc')!;

const selectBassistPreset = document.getElementById('select-bassist-preset') as HTMLSelectElement;
const selectBassSaturation = document.getElementById('select-bass-saturation') as HTMLSelectElement;
const sliderBassDrive = document.getElementById('slider-bass-drive') as HTMLInputElement;
const labelBassDrive = document.getElementById('label-bass-drive')!;
const bassSaturationDesc = document.getElementById('bass-saturation-desc')!;

const selectGuitarDistortion = document.getElementById('select-guitar-distortion') as HTMLSelectElement;
const sliderGuitarDrive = document.getElementById('slider-guitar-drive') as HTMLInputElement;
const labelGuitarDrive = document.getElementById('label-guitar-drive')!;
const guitarDistortionDesc = document.getElementById('guitar-distortion-desc')!;

const gemCardDrums = document.getElementById('gem-card-drums')!;
const gemCardBass = document.getElementById('gem-card-bass')!;
const gemCardGuitars = document.getElementById('gem-card-guitars')!;
const gemCardVocals = document.getElementById('gem-card-vocals')!;
const gemCardSynths = document.getElementById('gem-card-synths')!;
const btnProcessWelder = document.getElementById('btn-process-welder') as HTMLButtonElement;
const btnDownloadWelded = document.getElementById('btn-download-welded') as HTMLAnchorElement;
const welderProgressWrap = document.getElementById('welder-progress-wrap')!;
const welderProgressBar = document.getElementById('welder-progress-bar')!;
const welderProgressPct = document.getElementById('welder-progress-pct')!;
const welderProgressText = document.getElementById('welder-progress-text')!;
const welderStatusTag = document.getElementById('welder-status-tag')!;
const btnSoloGems = document.querySelectorAll('.btn-solo-gem') as NodeListOf<HTMLButtonElement>;

// Mic Locker Elements
const micsGalleryContainer = document.getElementById('mics-gallery-container')!;
const micsCount = document.getElementById('mics-count')!;
const micFilterBtns = document.querySelectorAll('.mic-filter-btn') as NodeListOf<HTMLButtonElement>;
const activeMicIcon = document.getElementById('active-mic-icon')!;
const activeMicBrand = document.getElementById('active-mic-brand')!;
const activeMicName = document.getElementById('active-mic-name')!;
const activeMicCapsule = document.getElementById('active-mic-capsule')!;
const activeMicPolar = document.getElementById('active-mic-polar')!;
const activeMicPreamp = document.getElementById('active-mic-preamp')!;
const activeMicUsers = document.getElementById('active-mic-users')!;
const micSliderDist = document.getElementById('mic-slider-dist') as HTMLInputElement;
const micSliderPreamp = document.getElementById('mic-slider-preamp') as HTMLInputElement;
const btnProcessMic = document.getElementById('btn-process-mic') as HTMLButtonElement;
const btnDownloadMic = document.getElementById('btn-download-mic') as HTMLAnchorElement;
const micProgressWrap = document.getElementById('mic-progress-wrap')!;
const micProgressBar = document.getElementById('mic-progress-bar')!;
const micProgressPct = document.getElementById('mic-progress-pct')!;
const micProgressText = document.getElementById('mic-progress-text')!;

// Vocal God Elements
const vocalDropzone = document.getElementById('vocal-dropzone')!;
const vocalFileInput = document.getElementById('vocal-file-input') as HTMLInputElement;
const vocalDropIdle = document.getElementById('vocal-drop-idle')!;
const vocalDropActive = document.getElementById('vocal-drop-active')!;
const vocalFileName = document.getElementById('vocal-file-name')!;
const vocalFileStats = document.getElementById('vocal-file-stats')!;
const vocalAudioPlayer = document.getElementById('vocal-audio-player') as HTMLAudioElement;
const selectVocalPreset = document.getElementById('select-vocal-preset') as HTMLSelectElement;
const vocalPresetDesc = document.getElementById('vocal-preset-desc')!;
const vocalSliderDeess = document.getElementById('vocal-slider-deess') as HTMLInputElement;
const vocalSliderAir = document.getElementById('vocal-slider-air') as HTMLInputElement;
const vocalSliderDoubler = document.getElementById('vocal-slider-doubler') as HTMLInputElement;
const btnProcessVocal = document.getElementById('btn-process-vocal') as HTMLButtonElement;
const btnDownloadVocal = document.getElementById('btn-download-vocal') as HTMLAnchorElement;
const vocalProgressWrap = document.getElementById('vocal-progress-wrap')!;
const vocalProgressBar = document.getElementById('vocal-progress-bar')!;
const vocalProgressPct = document.getElementById('vocal-progress-pct')!;
const vocalProgressText = document.getElementById('vocal-progress-text')!;

// 3D Spatial Audio Elements
const spatialRadarCanvas = document.getElementById('spatial-radar-canvas') as HTMLCanvasElement;
const selectSpatialPreset = document.getElementById('select-spatial-preset') as HTMLSelectElement;
const btnResetSpatial = document.getElementById('btn-reset-spatial') as HTMLButtonElement;
const spatialChannelsContainer = document.getElementById('spatial-channels-container')!;
const btnProcessSpatial = document.getElementById('btn-process-spatial') as HTMLButtonElement;
const btnDownloadSpatial = document.getElementById('btn-download-spatial') as HTMLAnchorElement;
const spatialProgressWrap = document.getElementById('spatial-progress-wrap')!;
const spatialProgressBar = document.getElementById('spatial-progress-bar')!;
const spatialProgressPct = document.getElementById('spatial-progress-pct')!;
const spatialProgressText = document.getElementById('spatial-progress-text')!;

// AI Match Elements
const aiTargetDropzone = document.getElementById('ai-target-dropzone')!;
const aiTargetFileInput = document.getElementById('ai-target-file-input') as HTMLInputElement;
const aiTargetTitle = document.getElementById('ai-target-title')!;
const aiTargetInfo = document.getElementById('ai-target-info')!;
const aiRefDropzone = document.getElementById('ai-ref-dropzone')!;
const aiRefFileInput = document.getElementById('ai-ref-file-input') as HTMLInputElement;
const aiRefTitle = document.getElementById('ai-ref-title')!;
const aiRefInfo = document.getElementById('ai-ref-info')!;
const btnRunAiMatch = document.getElementById('btn-run-ai-match') as HTMLButtonElement;
const btnDownloadAiMatch = document.getElementById('btn-download-ai-match') as HTMLAnchorElement;
const aiProgressWrap = document.getElementById('ai-progress-wrap')!;
const aiProgressBar = document.getElementById('ai-progress-bar')!;
const aiProgressPct = document.getElementById('ai-progress-pct')!;
const aiProgressText = document.getElementById('ai-progress-text')!;

// Meters
const meterIntLufs = document.getElementById('meter-int-lufs')!;
const meterTruePeak = document.getElementById('meter-true-peak')!;
const meterCrest = document.getElementById('meter-crest')!;
const meterSampleRate = document.getElementById('meter-sample-rate')!;
const meterGrVal = document.getElementById('meter-gr-val')!;

// Batch
const batchDropzone = document.getElementById('batch-dropzone')!;
const batchFileInput = document.getElementById('batch-file-input') as HTMLInputElement;
const batchList = document.getElementById('batch-list')!;
const btnRunBatch = document.getElementById('btn-run-batch') as HTMLButtonElement;

// Rotary Knobs references
let knobMasterSat: RotaryKnob;
let knobMasterWidth: RotaryKnob;
let knobMasterIntensity: RotaryKnob;
let knobVocalDeess: RotaryKnob;
let knobVocalAir: RotaryKnob;
let knobVocalDoubler: RotaryKnob;
let knobMicDist: RotaryKnob;
let knobMicDrive: RotaryKnob;

// ─── INITIALIZATION ──────────────────────────────────────────────────────────
function init() {
  const spectrumCanvas = document.getElementById('main-spectrum-canvas') as HTMLCanvasElement;
  const goniometerCanvas = document.getElementById('goniometer-canvas') as HTMLCanvasElement;
  const vuCanvas = document.getElementById('vu-meter-canvas') as HTMLCanvasElement;
  const vuCanvasSec = document.getElementById('vu-meter-canvas-secondary') as HTMLCanvasElement;

  spectrumVisualizer = new SpectrumVisualizer(spectrumCanvas);
  phaseGoniometer = new PhaseGoniometer(goniometerCanvas);
  vuMeter = new AnalogVuMeter(vuCanvas, true);
  if (vuCanvasSec) {
    vuMeterSec = new AnalogVuMeter(vuCanvasSec, true);
  }

  const peakCanvas = document.getElementById('transport-peak-meter-canvas') as HTMLCanvasElement;
  if (peakCanvas) {
    stereoPeakMeter = new StereoPeakMeter(peakCanvas);
  }

  setupRotaryKnobs();
  populateQuickSelectors();
  renderProducersList('all');
  selectMasterSetup(ALL_MASTERS[0].id, ALL_MASTERS[0].albums[0].id);

  renderMicsGallery('all');
  selectMic(LEGENDARY_MICROPHONES[0].id);

  setupTabs();
  setupAudioLoading();
  setupTransportDock();
  setupMasterProcessing();
  setupWelderProcessing();
  setupMicLockerModule();
  setupVocalModule();
  setupSpatialModule();
  setupAiMatchModule();
  setupBatchProcessing();
  setupArrangerModule();
  ProKeybindingsMatrix.init();
}

// ─── ROTARY KNOBS INITIALIZATION ─────────────────────────────────────────────
function setupRotaryKnobs() {
  const elSat = document.getElementById('knob-master-sat')!;
  const elWidth = document.getElementById('knob-master-width')!;
  const elInt = document.getElementById('knob-master-intensity')!;

  knobMasterSat = new RotaryKnob({
    element: elSat,
    min: 30,
    max: 200,
    initialValue: 100,
    unit: '%',
    color: 'red',
    onChange: (v) => {
      sliderSat.value = String(v);
      labelSatVal.textContent = `${v}%`;
      updateTubeGlow(v);
    }
  });

  knobMasterWidth = new RotaryKnob({
    element: elWidth,
    min: 80,
    max: 180,
    initialValue: 142,
    unit: '%',
    color: 'cyan',
    onChange: (v) => {
      sliderWidth.value = String(v);
      labelWidthVal.textContent = `${v}%`;
    }
  });

  knobMasterIntensity = new RotaryKnob({
    element: elInt,
    min: 50,
    max: 150,
    initialValue: 100,
    unit: '%',
    color: 'gold',
    onChange: (v) => {
      sliderIntensity.value = String(v);
      labelIntensityVal.textContent = `${v}%`;
    }
  });

  // Vocal Knobs
  const elVDeess = document.getElementById('knob-vocal-deess')!;
  const elVAir = document.getElementById('knob-vocal-air')!;
  const elVDoubler = document.getElementById('knob-vocal-doubler')!;

  knobVocalDeess = new RotaryKnob({
    element: elVDeess,
    min: 0,
    max: 100,
    initialValue: 50,
    unit: '%',
    color: 'gold',
    onChange: (v) => { vocalSliderDeess.value = String(v); }
  });

  knobVocalAir = new RotaryKnob({
    element: elVAir,
    min: 0,
    max: 12,
    step: 0.5,
    initialValue: 5.0,
    unit: ' dB',
    color: 'cyan',
    onChange: (v) => { vocalSliderAir.value = String(v); }
  });

  knobVocalDoubler = new RotaryKnob({
    element: elVDoubler,
    min: 0,
    max: 100,
    initialValue: 60,
    unit: '%',
    color: 'red',
    onChange: (v) => { vocalSliderDoubler.value = String(v); }
  });

  // Mic Knobs
  const elMDist = document.getElementById('knob-mic-dist')!;
  const elMDrive = document.getElementById('knob-mic-drive')!;

  knobMicDist = new RotaryKnob({
    element: elMDist,
    min: 1,
    max: 25,
    initialValue: 5,
    unit: ' cm',
    color: 'gold',
    onChange: (v) => { micSliderDist.value = String(v); }
  });

  knobMicDrive = new RotaryKnob({
    element: elMDrive,
    min: 50,
    max: 150,
    initialValue: 100,
    unit: '%',
    color: 'red',
    onChange: (v) => { micSliderPreamp.value = String(v); }
  });
}

function updateTubeGlow(drivePct: number) {
  if (!masterTubeFilament) return;
  const brightness = 0.6 + (drivePct / 200) * 0.9;
  const blurPx = 10 + (drivePct / 200) * 25;
  masterTubeFilament.style.filter = `brightness(${brightness})`;
  masterTubeFilament.style.boxShadow = `0 0 ${blurPx}px rgba(255, 119, 0, 0.95), 0 0 ${blurPx * 2}px rgba(255, 68, 0, 0.7)`;
}

// ─── PRODUCERS QUICK SELECTORS & DRAWER ──────────────────────────────────────
function populateQuickSelectors() {
  selectProducerQuick.innerHTML = '';
  ALL_MASTERS.forEach(prod => {
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.name} (${prod.era}) — ${prod.title}`;
    if (prod.id === activeProducer.id) opt.selected = true;
    selectProducerQuick.appendChild(opt);
  });

  updateAlbumQuickSelector();

  selectProducerQuick.addEventListener('change', () => {
    const prodId = selectProducerQuick.value;
    const prod = ALL_MASTERS.find(p => p.id === prodId);
    if (prod) {
      activeProducer = prod;
      activeAlbum = prod.albums[0];
      updateAlbumQuickSelector();
      selectMasterSetup(activeProducer.id, activeAlbum.id);
    }
  });

  selectAlbumQuick.addEventListener('change', () => {
    selectMasterSetup(activeProducer.id, selectAlbumQuick.value);
  });

  btnToggleProducersDrawer.addEventListener('click', () => {
    producersDrawerPanel.classList.toggle('hidden');
  });
}

function updateAlbumQuickSelector() {
  selectAlbumQuick.innerHTML = '';
  activeProducer.albums.forEach(alb => {
    const opt = document.createElement('option');
    opt.value = alb.id;
    opt.textContent = `${alb.band} — ${alb.albumTitle} (${alb.year}) [${alb.targetLufs} LUFS]`;
    if (alb.id === activeAlbum.id) opt.selected = true;
    selectAlbumQuick.appendChild(opt);
  });
}

// ─── PRODUCERS LIST & CATEGORY FILTERS ────────────────────────────────────────
function renderProducersList(category: string) {
  const filtered = category === 'all'
    ? ALL_MASTERS
    : ALL_MASTERS.filter(m => m.category === category);

  producerCardsContainer.innerHTML = '';

  filtered.forEach((prod) => {
    const isSelected = prod.id === activeProducer.id;
    const card = document.createElement('div');
    card.setAttribute('data-producer-id', prod.id);
    card.className = `producer-card ${isSelected ? 'active' : ''}`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--gold-primary); font-weight: 700; text-transform: uppercase;">${prod.era}</span>
        <span style="font-family: var(--font-mono); font-size: 10px; color: #94a3b8; background: #060910; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); font-weight: 700;">${prod.albums.length} Álbuns</span>
      </div>
      <div>
        <h4 style="font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #ffffff; text-transform: uppercase;">${prod.name}</h4>
        <p style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-light); font-weight: 600; margin-top: 2px;">${prod.title}</p>
      </div>
      <div>
        <label style="font-family: var(--font-mono); font-size: 10px; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">Álbum:</label>
        <select class="album-dropdown studio-select" data-producer-id="${prod.id}">
          ${prod.albums.map((alb, aIdx) => `
            <option value="${alb.id}" ${aIdx === 0 ? 'selected' : ''}>
              ${alb.band} - ${alb.albumTitle} (${alb.year})
            </option>
          `).join('')}
        </select>
      </div>
      <button type="button" class="btn-select-producer ${isSelected ? 'btn-gold-action' : 'switch-toggle-btn'}" style="width: 100%; padding: 8px; font-size: 11px;">
        ${isSelected ? '✓ CONSOLE ATIVO' : 'CARREGAR NO CONSOLE'}
      </button>
    `;

    const dropdown = card.querySelector('.album-dropdown') as HTMLSelectElement;
    dropdown.addEventListener('change', (e) => {
      e.stopPropagation();
      selectMasterSetup(prod.id, dropdown.value);
    });

    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'OPTION') return;
      selectMasterSetup(prod.id, dropdown.value);
    });

    producerCardsContainer.appendChild(card);
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active-filter', 'active'));
    btn.classList.add('active-filter', 'active');
    const cat = btn.getAttribute('data-category') || 'all';
    renderProducersList(cat);
  });
});

// ─── MASTER SETUP SELECTION ──────────────────────────────────────────────────
function selectMasterSetup(producerId: string, albumId?: string) {
  const prod = ALL_MASTERS.find(p => p.id === producerId);
  if (!prod) return;

  activeProducer = prod;
  if (albumId) {
    const alb = prod.albums.find(a => a.id === albumId);
    activeAlbum = alb || prod.albums[0];
  } else {
    activeAlbum = prod.albums[0];
  }

  // Keep quick dropdowns in sync
  if (selectProducerQuick.value !== activeProducer.id) {
    selectProducerQuick.value = activeProducer.id;
    updateAlbumQuickSelector();
  }
  if (selectAlbumQuick.value !== activeAlbum.id) {
    selectAlbumQuick.value = activeAlbum.id;
  }

  const allCards = document.querySelectorAll('.producer-card');
  allCards.forEach(c => {
    const isThis = c.getAttribute('data-producer-id') === prod.id;
    c.classList.toggle('active', isThis);

    const btn = c.querySelector('.btn-select-producer') as HTMLElement;
    if (btn) {
      btn.textContent = isThis ? '✓ CONSOLE ATIVO' : 'CARREGAR NO CONSOLE';
      btn.className = `btn-select-producer ${isThis ? 'btn-gold-action' : 'switch-toggle-btn'}`;
    }
  });

  activeMasterTag.textContent = activeProducer.name;
  activeEraTag.textContent = activeProducer.era.split(' ')[0].toUpperCase();
  activeAlbumTitle.textContent = `${activeAlbum.band} - ${activeAlbum.albumTitle} (${activeAlbum.year})`;
  activeCountryText.textContent = `${activeProducer.country} · ${activeProducer.title}`;
  specTuning.textContent = activeAlbum.tuningSignature ? `${activeAlbum.tuningSignature.standardName} [${activeAlbum.tuningSignature.baseFreqA4Hz}Hz]` : 'Standard E (440Hz)';
  specGuitarAmp.textContent = activeAlbum.guitarToneprint ? `${activeAlbum.guitarToneprint.ampModel.toUpperCase().replace('_', ' ')} (Drive ${Math.round(activeAlbum.guitarToneprint.distortionGain * 100)}%)` : 'Mesa Rectifier';
  specLufs.textContent = `${activeAlbum.targetLufs} LUFS`;
  specSat.textContent = `${activeAlbum.saturation.type.replace('_', ' ').toUpperCase()} (${Math.round(activeAlbum.saturation.drive * 100)}%)`;
  specComp.textContent = `Ratio ${activeAlbum.compressor.ratio}:1`;
  specWidth.textContent = `${Math.round(activeAlbum.stereoWidth * 100)}%`;
  specChain.textContent = activeAlbum.hardwareChain;

  const satVal = Math.round(activeAlbum.saturation.drive * 100);
  const widthVal = Math.round(activeAlbum.stereoWidth * 100);

  sliderSat.value = String(satVal);
  sliderWidth.value = String(widthVal);
  knobMasterSat?.setValue(satVal, false);
  knobMasterWidth?.setValue(widthVal, false);
  updateTubeGlow(satVal);

  gemCardDrums.textContent = activeAlbum.gemSetup.drums.description;
  gemCardBass.textContent = activeAlbum.gemSetup.bass.description;
  gemCardGuitars.textContent = activeAlbum.gemSetup.guitars.description;
  gemCardVocals.textContent = activeAlbum.gemSetup.vocals.description;
  gemCardSynths.textContent = activeAlbum.gemSetup.synthsFx.description;

  spectrumVisualizer.setTargetAlbum(activeAlbum);
}

// ─── MIC LOCKER GALLERY & LOGIC ──────────────────────────────────────────────
function renderMicsGallery(category: string) {
  const filtered = category === 'all'
    ? LEGENDARY_MICROPHONES
    : LEGENDARY_MICROPHONES.filter(m => m.category === category);

  micsCount.textContent = `${filtered.length} Microfones Históricos Disponíveis`;
  micsGalleryContainer.innerHTML = '';

  filtered.forEach(mic => {
    const isSelected = mic.id === activeMic.id;
    const card = document.createElement('div');
    card.setAttribute('data-mic-id', mic.id);
    card.className = `mic-card ${isSelected ? 'active' : ''}`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--gold-primary); font-weight: 700; text-transform: uppercase;">${mic.brand} · ${mic.year}</span>
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--cyan-light); background: #060910; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); text-transform: uppercase; font-weight: 700;">${mic.capsule}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 22px;">${mic.icon}</span>
        <div>
          <h4 style="font-family: var(--font-display); font-size: 13px; font-weight: 800; color: #ffffff; text-transform: uppercase;">${mic.name}</h4>
          <span style="font-family: var(--font-mono); font-size: 10px; color: #94a3b8; text-transform: uppercase;">Padrão: <strong style="color: #cbd5e1;">${mic.polarPattern}</strong></span>
        </div>
      </div>
      <p style="font-family: var(--font-mono); font-size: 11px; color: #cbd5e1; line-height: 1.4;">${mic.soundDescription}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 8px; font-family: var(--font-mono); font-size: 10px;">
        <span style="color: #64748b;">Pré: <strong style="color: var(--gold-light);">${mic.preampType.toUpperCase().replace('_', ' ')}</strong></span>
        <button type="button" class="btn-select-mic ${isSelected ? 'btn-gold-action' : 'switch-toggle-btn'}" style="padding: 4px 10px; font-size: 10px;">
          ${isSelected ? '✓ EQUIPADO' : 'EQUIPAR'}
        </button>
      </div>
    `;

    card.addEventListener('click', () => selectMic(mic.id));
    micsGalleryContainer.appendChild(card);
  });
}

function selectMic(micId: string) {
  const mic = LEGENDARY_MICROPHONES.find(m => m.id === micId);
  if (!mic) return;

  activeMic = mic;

  const allCards = document.querySelectorAll('.mic-card');
  allCards.forEach(c => {
    const isThis = c.getAttribute('data-mic-id') === mic.id;
    c.classList.toggle('border-amber-500', isThis);
    c.classList.toggle('bg-amber-950/30', isThis);
    c.classList.toggle('shadow-[0_0_15px_rgba(245,158,11,0.3)]', isThis);
    c.classList.toggle('border-slate-800', !isThis);
    c.classList.toggle('bg-transparent', !isThis);

    const btn = c.querySelector('.btn-select-mic');
    if (btn) {
      btn.textContent = isThis ? '✓ Selecionado' : 'Equipar';
      btn.className = `btn-select-mic px-2 py-0.5 rounded font-bold ${
        isThis ? 'bg-amber-500 text-black' : 'bg-slate-900 border border-slate-700 text-amber-300'
      }`;
    }
  });

  activeMicIcon.textContent = mic.icon;
  activeMicBrand.textContent = mic.brand;
  activeMicName.textContent = mic.name;
  activeMicCapsule.textContent = mic.capsule.replace('_', ' ').toUpperCase();
  activeMicPolar.textContent = mic.polarPattern.replace('_', ' ').toUpperCase();
  activeMicPreamp.textContent = `${mic.preampType.replace('_', ' ').toUpperCase()} (${Math.round(mic.preampDrive * 100)}% DRIVE)`;
  activeMicUsers.textContent = mic.famousUsers;
}

micFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    micFilterBtns.forEach(b => b.classList.remove('active-filter', 'text-amber-400', 'border-amber-500'));
    btn.classList.add('active-filter', 'text-amber-400', 'border-amber-500');
    const cat = btn.getAttribute('data-mic-category') || 'all';
    renderMicsGallery(cat);
  });
});

function setupMicLockerModule() {
  btnProcessMic.addEventListener('click', async () => {
    const buf = vocalBuffer || audioBuffer;
    if (!buf) return;

    btnProcessMic.disabled = true;
    micProgressWrap.classList.remove('hidden');

    try {
      const res = await MicModelingEngine.modelMicrophone(buf, {
        mic: activeMic,
        distanceCm: parseFloat(micSliderDist.value),
        preampDriveMultiplier: parseFloat(micSliderPreamp.value) / 100,
        onProgress: (pct, txt) => {
          micProgressBar.style.width = `${pct}%`;
          micProgressPct.textContent = `${pct}%`;
          micProgressText.textContent = txt;
        }
      });

      const mUrl = URL.createObjectURL(res.wavBlob);
      btnDownloadMic.href = mUrl;
      btnDownloadMic.download = res.downloadFilename;
      btnDownloadMic.classList.remove('hidden');

      mainAudioPlayer.src = mUrl;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } catch (err: any) {
      console.error('[MicLocker] Modeling error:', err);
      micProgressText.textContent = `❌ Erro: ${err.message || String(err)}`;
    } finally {
      btnProcessMic.disabled = false;
    }
  });
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function setupTabs() {
  const tabs = document.querySelectorAll('.studio-tab') as NodeListOf<HTMLButtonElement>;
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.add('hidden'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        document.getElementById(targetId)?.classList.remove('hidden');
      }
      if (targetId === 'tab-spatial') {
        renderSpatialRadar();
      }
    });
  });
}

// ─── AUDIO LOADING & TRANSPORT DOCK ──────────────────────────────────────────
function setupAudioLoading() {
  audioDropzone.addEventListener('click', () => audioFileInput.click());
  audioFileInput.addEventListener('change', () => {
    const file = audioFileInput.files?.[0];
    if (file) loadAudioFile(file);
  });
  audioDropzone.addEventListener('dragover', (e) => { e.preventDefault(); audioDropzone.classList.add('border-amber-400'); });
  audioDropzone.addEventListener('dragleave', () => { audioDropzone.classList.remove('border-amber-400'); });
  audioDropzone.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    audioDropzone.classList.remove('border-amber-400');
    const file = e.dataTransfer?.files[0];
    if (file) loadAudioFile(file);
  });
}

function setupTransportDock() {
  const readout = document.getElementById('transport-peak-readout');

  function initPlaybackMeter() {
    if (playbackAudioCtx) {
      if (playbackAudioCtx.state === 'suspended') {
        playbackAudioCtx.resume();
      }
      return;
    }
    try {
      // @ts-ignore
      playbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      playbackSourceNode = playbackAudioCtx.createMediaElementSource(mainAudioPlayer);

      const splitter = playbackAudioCtx.createChannelSplitter(2);
      analyserL = playbackAudioCtx.createAnalyser();
      analyserR = playbackAudioCtx.createAnalyser();
      analyserL.fftSize = 512;
      analyserR.fftSize = 512;
      playbackDataL = new Float32Array(analyserL.frequencyBinCount);
      playbackDataR = new Float32Array(analyserR.frequencyBinCount);

      // Safe master playback trim (-2.5dB headroom) to protect soundcards from clipping
      const safeOutputGain = playbackAudioCtx.createGain();
      safeOutputGain.gain.value = 0.75;

      playbackSourceNode.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      playbackSourceNode.connect(safeOutputGain);
      safeOutputGain.connect(playbackAudioCtx.destination);

      startPeakMeterLoop();
    } catch (err) {
      console.warn('[MasterStudio] MediaElementSource init fallback:', err);
    }
  }

  function startPeakMeterLoop() {
    if (isPeakMeterRunning) return;
    isPeakMeterRunning = true;

    function loop() {
      if (playbackAudioCtx && !mainAudioPlayer.paused && analyserL && analyserR) {
        analyserL.getFloatTimeDomainData(playbackDataL);
        analyserR.getFloatTimeDomainData(playbackDataR);

        let peakL = 0;
        let peakR = 0;
        for (let i = 0; i < playbackDataL.length; i++) {
          const aL = Math.abs(playbackDataL[i]);
          if (aL > peakL) peakL = aL;
          const aR = Math.abs(playbackDataR[i]);
          if (aR > peakR) peakR = aR;
        }

        stereoPeakMeter.updateLevels(peakL, peakR);

        if (readout) {
          const dbL = peakL > 0.0001 ? (20 * Math.log10(peakL)).toFixed(1) : '-∞';
          const dbR = peakR > 0.0001 ? (20 * Math.log10(peakR)).toFixed(1) : '-∞';
          const isClip = stereoPeakMeter.hasClipped();
          readout.textContent = `L: ${dbL} dB | R: ${dbR} dB`;
          readout.style.color = isClip ? '#ef4444' : (parseFloat(dbL) > -3 || parseFloat(dbR) > -3 ? '#f59e0b' : '#10b981');
        }
      } else if (stereoPeakMeter) {
        stereoPeakMeter.updateLevels(0, 0);
        if (readout && mainAudioPlayer.paused) {
          readout.textContent = 'L: -∞ dB | R: -∞ dB';
          readout.style.color = '#10b981';
        }
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  btnTransportPlay.addEventListener('click', () => {
    if (!mainAudioPlayer.src) return;
    initPlaybackMeter();
    if (mainAudioPlayer.paused) {
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } else {
      mainAudioPlayer.pause();
      btnTransportPlay.textContent = '▶';
    }
  });

  mainAudioPlayer.addEventListener('timeupdate', () => {
    if (!mainAudioPlayer.duration) return;
    const cur = mainAudioPlayer.currentTime;
    const dur = mainAudioPlayer.duration;
    transportScrub.value = String((cur / dur) * 100);

    const cMin = Math.floor(cur / 60);
    const cSec = Math.floor(cur % 60).toString().padStart(2, '0');
    const dMin = Math.floor(dur / 60);
    const dSec = Math.floor(dur % 60).toString().padStart(2, '0');

    transportTimeCurrent.textContent = `${cMin}:${cSec}`;
    transportTimeTotal.textContent = `${dMin}:${dSec}`;
  });

  transportScrub.addEventListener('input', () => {
    if (!mainAudioPlayer.duration) return;
    const pct = parseFloat(transportScrub.value) / 100;
    mainAudioPlayer.currentTime = pct * mainAudioPlayer.duration;
  });

  // Jump to Loudest Section / Chorus
  const btnJumpLoudest = document.getElementById('btn-jump-loudest') as HTMLButtonElement;
  btnJumpLoudest?.addEventListener('click', () => {
    if (!audioBuffer) return;
    const loudestSec = WaveformScrubber.findLoudestSectionSec();
    mainAudioPlayer.currentTime = loudestSec;
    if (mainAudioPlayer.paused) {
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    }
  });

  const chkAbGainMatch = document.getElementById('chk-ab-gain-match') as HTMLInputElement;

  btnAbOrig.addEventListener('click', () => {
    if (!loadedFile) return;
    const currentPlayTime = mainAudioPlayer.currentTime;
    const wasPlaying = !mainAudioPlayer.paused;
    initPlaybackMeter();
    mainAudioPlayer.src = URL.createObjectURL(loadedFile);
    mainAudioPlayer.volume = isDim ? 0.1 : 1.0;
    mainAudioPlayer.onloadedmetadata = () => {
      mainAudioPlayer.currentTime = currentPlayTime;
      if (wasPlaying) mainAudioPlayer.play();
    };
    btnAbOrig.className = 'switch-toggle-btn active-red';
    btnAbMaster.className = 'switch-toggle-btn';
  });

  btnAbMaster.addEventListener('click', () => {
    const blob = lastWelderResult?.weldedWavBlob || lastMasterResult?.wavBlob;
    if (!blob) return;
    const currentPlayTime = mainAudioPlayer.currentTime;
    const wasPlaying = !mainAudioPlayer.paused;
    initPlaybackMeter();

    let gainMatchScale = 1.0;
    if (chkAbGainMatch?.checked && audioBuffer && lastMasterResult?.masterBuffer) {
      const match = PerceptualLoudnessMatcher.computeMatchingGain(audioBuffer, lastMasterResult.masterBuffer);
      gainMatchScale = match.masterGain;
    }

    mainAudioPlayer.src = URL.createObjectURL(blob);
    mainAudioPlayer.volume = isDim ? 0.1 : gainMatchScale;
    mainAudioPlayer.onloadedmetadata = () => {
      mainAudioPlayer.currentTime = currentPlayTime;
      if (wasPlaying) mainAudioPlayer.play();
    };
    btnAbMaster.className = 'switch-toggle-btn active-gold';
    btnAbOrig.className = 'switch-toggle-btn';
  });

  btnMonoCheck.addEventListener('click', () => {
    isMono = !isMono;
    btnMonoCheck.classList.toggle('active-on', isMono);
  });

  btnDim.addEventListener('click', () => {
    isDim = !isDim;
    btnDim.classList.toggle('active-red', isDim);
    mainAudioPlayer.volume = isDim ? 0.1 : 1.0;
  });

  const selectStudioMonitor = document.getElementById('select-studio-monitor') as HTMLSelectElement;
  selectStudioMonitor?.addEventListener('change', () => {
    BinauralStudioMonitor.setModel(selectStudioMonitor.value as any);
  });
}

async function loadAudioFile(file: File) {
  loadedFile = file;
  loadedFileName.textContent = file.name;
  loadedFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`;

  dropIdleState.classList.add('hidden');
  dropActiveState.classList.remove('hidden');

  const fileUrl = URL.createObjectURL(file);
  mainAudioPlayer.src = fileUrl;

  try {
    const arrBuf = await file.arrayBuffer();
    // @ts-ignore
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = await audioCtx.decodeAudioData(arrBuf);

    const dur = audioBuffer.duration;
    const mins = Math.floor(dur / 60);
    const secs = Math.floor(dur % 60).toString().padStart(2, '0');
    loadedFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${mins}:${secs}`;
    transportTimeTotal.textContent = `${mins}:${secs}`;

    btnProcessMaster.disabled = false;
    btnProcessMaster.classList.remove('opacity-50', 'cursor-not-allowed');

    btnProcessWelder.disabled = false;
    btnProcessWelder.classList.remove('opacity-50', 'cursor-not-allowed');

    btnProcessMic.disabled = false;
    btnProcessMic.classList.remove('opacity-50', 'cursor-not-allowed');

    btnProcessSpatial.disabled = false;
    btnProcessSpatial.classList.remove('opacity-50', 'cursor-not-allowed');

    initArrangerWithAudio(audioBuffer);

    // ─── AUTOMATIC KEY & MUSICAL SCALE DETECTION ────────────────────────────
    try {
      const keyRes = KeyDetectorEngine.detectKey(audioBuffer);
      const selectPitchRoot = document.getElementById('select-pitch-root-key') as HTMLSelectElement;
      const selectPitchScale = document.getElementById('select-pitch-scale') as HTMLSelectElement;
      const labelKeyBadge = document.getElementById('label-detected-key-badge');

      if (selectPitchRoot) selectPitchRoot.value = keyRes.rootKey;
      if (selectPitchScale) selectPitchScale.value = keyRes.scale;
      if (labelKeyBadge) {
        labelKeyBadge.textContent = `⚡ TOM DETECTADO: ${keyRes.keyName} (${(keyRes.confidence * 100).toFixed(1)}% Confiança)`;
      }
      console.log(`[MasterStudio] Key Detected: ${keyRes.keyName} (${(keyRes.confidence * 100).toFixed(1)}%)`);
    } catch (kErr) {
      console.warn('[MasterStudio] Key detection warning:', kErr);
    }

    meterSampleRate.textContent = `${(audioBuffer.sampleRate / 1000).toFixed(1)} kHz 24-bit HD`;
  } catch (err) {
    console.error('[MasterStudio] Audio decode error:', err);
    loadedFileStats.textContent = '❌ Erro ao decodificar.';
  }
}

// ─── MASTERING ENGINE ────────────────────────────────────────────────────────
function setupMasterProcessing() {
  const sliderDrumBlend = document.getElementById('slider-drum-blend') as HTMLInputElement;
  const labelDrumBlendVal = document.getElementById('label-drum-blend-val') as HTMLSpanElement;
  const sliderGuitarBlend = document.getElementById('slider-guitar-blend') as HTMLInputElement;
  const labelGuitarBlendVal = document.getElementById('label-guitar-blend-val') as HTMLSpanElement;
  const sliderBassBlend = document.getElementById('slider-bass-blend') as HTMLInputElement;
  const labelBassBlendVal = document.getElementById('label-bass-blend-val') as HTMLSpanElement;
  const sliderVocalBlend = document.getElementById('slider-vocal-blend') as HTMLInputElement;
  const labelVocalBlendVal = document.getElementById('label-vocal-blend-val') as HTMLSpanElement;
  const multiFormatExportWrap = document.getElementById('multi-format-export-wrap');
  const btnExport32bit = document.getElementById('btn-export-32bit') as HTMLButtonElement;
  const btnExport16bit = document.getElementById('btn-export-16bit') as HTMLButtonElement;

  // ─── MASTER VOICE CLONER WIRING ──────────────────────────────────────────
  const masterVoiceDropzone = document.getElementById('master-user-voice-dropzone');
  const masterVoiceInput = document.getElementById('master-user-voice-input') as HTMLInputElement;
  const masterVoiceIdle = document.getElementById('master-user-voice-idle');
  const masterVoiceActive = document.getElementById('master-user-voice-active');
  const masterVoiceFilename = document.getElementById('master-user-voice-filename');
  const masterVoiceBadge = document.getElementById('master-voice-clone-badge');
  const transportVoiceBtn = document.getElementById('transport-user-voice-btn');

  const handleUserVoiceFile = async (file: File) => {
    if (!file) return;
    if (masterVoiceFilename) masterVoiceFilename.textContent = file.name;
    masterVoiceIdle?.classList.add('hidden');
    masterVoiceActive?.classList.remove('hidden');

    try {
      const arr = await file.arrayBuffer();
      // @ts-ignore
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const userBuf = await ctx.decodeAudioData(arr);
      const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(userBuf);
      if (masterVoiceBadge) {
        masterVoiceBadge.textContent = `⚡ CLONE ATIVO (+${fp.singersFormantDb.toFixed(1)}dB Metal Power)`;
        masterVoiceBadge.style.color = 'var(--emerald-primary)';
        masterVoiceBadge.style.borderColor = 'var(--emerald-primary)';
      }
      if (transportVoiceBtn) {
        transportVoiceBtn.style.borderColor = 'var(--emerald-primary)';
        transportVoiceBtn.style.color = 'var(--emerald-primary)';
      }
    } catch (e) {
      console.error('[VoiceCloner] Decode error:', e);
    }
  };

  masterVoiceDropzone?.addEventListener('click', () => masterVoiceInput?.click());
  transportVoiceBtn?.addEventListener('click', () => masterVoiceInput?.click());
  masterVoiceInput?.addEventListener('change', () => {
    const file = masterVoiceInput.files?.[0];
    if (file) handleUserVoiceFile(file);
  });

  const selectGuitarDoubling = document.getElementById('select-guitar-doubling') as HTMLSelectElement;
  const selectGuitarHarmony = document.getElementById('select-guitar-harmony') as HTMLSelectElement;
  const selectBassDoubling = document.getElementById('select-bass-doubling') as HTMLSelectElement;
  const selectVocalHarmony = document.getElementById('select-vocal-harmony') as HTMLSelectElement;

  const chkPitchEnable = document.getElementById('chk-pitch-correct-enable') as HTMLInputElement;
  const selectPitchRoot = document.getElementById('select-pitch-root-key') as HTMLSelectElement;
  const selectPitchScale = document.getElementById('select-pitch-scale') as HTMLSelectElement;
  const sliderRetuneSpeed = document.getElementById('slider-retune-speed') as HTMLInputElement;
  const labelRetuneSpeedVal = document.getElementById('label-retune-speed-val') as HTMLSpanElement;

  sliderRetuneSpeed?.addEventListener('input', () => {
    const val = parseFloat(sliderRetuneSpeed.value);
    if (labelRetuneSpeedVal) {
      labelRetuneSpeedVal.textContent = val > 70 ? `${val}% (Hard Auto-Tune)` : val > 30 ? `${val}% (Pop/Trap)` : `${val}% (Natural Suave)`;
    }
  });

  sliderDrumBlend?.addEventListener('input', () => {
    if (labelDrumBlendVal) labelDrumBlendVal.textContent = `${sliderDrumBlend.value}%`;
  });

  sliderGuitarBlend?.addEventListener('input', () => {
    if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = `${sliderGuitarBlend.value}%`;
  });

  const sliderTransientPunch = document.getElementById('slider-transient-punch') as HTMLInputElement;
  const labelTransientPunchVal = document.getElementById('label-transient-punch-val');
  sliderTransientPunch?.addEventListener('input', () => {
    if (labelTransientPunchVal) labelTransientPunchVal.textContent = `${sliderTransientPunch.value}%`;
  });

  sliderBassBlend?.addEventListener('input', () => {
    if (labelBassBlendVal) labelBassBlendVal.textContent = `${sliderBassBlend.value}%`;
  });

  const selectInputSourceMode = document.getElementById('select-input-source-mode') as HTMLSelectElement;
  const sourceModeHint = document.getElementById('source-mode-hint');

  selectInputSourceMode?.addEventListener('change', () => {
    const mode = selectInputSourceMode.value;
    if (mode === 'studio_demo') {
      if (sourceModeHint) sourceModeHint.innerHTML = '✅ <strong>Modo Estúdio Puro:</strong> Preserva 100% dos seus instrumentos e voz originais sem re-síntese ou dobras artificiais.';
      if (sliderDrumBlend) sliderDrumBlend.value = '0';
      if (sliderGuitarBlend) sliderGuitarBlend.value = '0';
      if (sliderBassBlend) sliderBassBlend.value = '0';
      if (sliderVocalBlend) sliderVocalBlend.value = '0';
      if (labelDrumBlendVal) labelDrumBlendVal.textContent = '0%';
      if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = '0%';
      if (labelBassBlendVal) labelBassBlendVal.textContent = '0%';
      if (labelVocalBlendVal) labelVocalBlendVal.textContent = '0%';
      if (selectGuitarDoubling) selectGuitarDoubling.value = 'off';
      if (selectGuitarHarmony) selectGuitarHarmony.value = 'none';
      if (selectVocalHarmony) selectVocalHarmony.value = 'none';
    } else if (mode === 'ai_generated') {
      if (sourceModeHint) sourceModeHint.innerHTML = '🤖 <strong>Modo IA:</strong> Reconstrói baterias, guitarras e remove defeitos e robôs do Suno/Udio.';
      if (sliderDrumBlend) sliderDrumBlend.value = '65';
      if (sliderGuitarBlend) sliderGuitarBlend.value = '65';
      if (sliderBassBlend) sliderBassBlend.value = '65';
      if (sliderVocalBlend) sliderVocalBlend.value = '65';
      if (labelDrumBlendVal) labelDrumBlendVal.textContent = '65%';
      if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = '65%';
      if (labelBassBlendVal) labelBassBlendVal.textContent = '65%';
      if (labelVocalBlendVal) labelVocalBlendVal.textContent = '65%';
      if (selectGuitarDoubling) selectGuitarDoubling.value = 'double_2x';
    } else {
      if (sourceModeHint) sourceModeHint.innerHTML = '⚡ <strong>Auto-Detecção:</strong> O sistema inspeciona a coerência de fase e seleciona a melhor rota analógica.';
    }
  });

  sliderVocalBlend?.addEventListener('input', () => {
    if (labelVocalBlendVal) labelVocalBlendVal.textContent = `${sliderVocalBlend.value}%`;
  });

  const btnAiAutoCalibrate = document.getElementById('btn-ai-autocalibrate') as HTMLButtonElement;
  if (btnAiAutoCalibrate) {
    btnAiAutoCalibrate.addEventListener('click', () => {
      if (!audioBuffer) {
        audioFileInput.click();
        return;
      }
      btnAiAutoCalibrate.textContent = '⏳ Auto-Calibrando Parâmetros...';
      const cal = AiMasterAutoCalibrator.autoCalibrate(audioBuffer, activeAlbum);
      
      sliderSat.value = `${Math.round(cal.recommendedDrive * 100)}`;
      sliderWidth.value = `${Math.round(cal.recommendedWidth * 100)}`;
      if (valSat) valSat.textContent = `${Math.round(cal.recommendedDrive * 100)}%`;
      if (valWidth) valWidth.textContent = `${Math.round(cal.recommendedWidth * 100)}%`;

      const chkDynamicDeHarsh = document.getElementById('chk-dynamic-deharsh') as HTMLInputElement;
      const chkKickBassUnmask = document.getElementById('chk-kick-bass-unmask') as HTMLInputElement;
      if (chkDynamicDeHarsh) chkDynamicDeHarsh.checked = cal.recommendedDeHarsh;
      if (chkKickBassUnmask) chkKickBassUnmask.checked = cal.recommendedUnmask;

      btnAiAutoCalibrate.textContent = `✨ MATCH ${cal.similarityScore}% ATINGIDO!`;
      setTimeout(() => {
        btnAiAutoCalibrate.textContent = '🪄 AUTO-CALIBRAR PARA MATCH PERFEITO (>99.5%)';
      }, 3000);
    });
  }

  btnProcessMaster.addEventListener('click', async () => {
    if (!audioBuffer) {
      audioFileInput.click();
      const sourceModeHint = document.getElementById('source-mode-hint');
      if (sourceModeHint) {
        sourceModeHint.innerHTML = '⚠️ <strong>Por favor, selecione seu arquivo de áudio (WAV, MP3) primeiro!</strong>';
        sourceModeHint.style.color = '#f59e0b';
      }
      return;
    }
    btnProcessMaster.disabled = true;
    btnProcessMaster.classList.add('opacity-50');
    masterProgressWrap.classList.remove('hidden');
    masterProgressBar.style.width = '2%';
    masterProgressPct.textContent = '2%';
    masterProgressText.textContent = 'Iniciando Masterização Quântica Analógica...';

    try {
      const selectStreamingTarget = document.getElementById('select-streaming-target') as HTMLSelectElement;
      const selectAnalogTapeModel = document.getElementById('select-analog-tape-model') as HTMLSelectElement;
      const selectLimiterMode = document.getElementById('select-limiter-mode') as HTMLSelectElement;
      const selectRealWorldDevice = document.getElementById('select-real-world-device') as HTMLSelectElement;
      const selectDrumKitModel = document.getElementById('select-drum-kit-model') as HTMLSelectElement;
      const selectGuitarRigModel = document.getElementById('select-guitar-rig-model') as HTMLSelectElement;
      const selectBassRigModel = document.getElementById('select-bass-rig-model') as HTMLSelectElement;
      const selectSecretProducerHack = document.getElementById('select-secret-producer-hack') as HTMLSelectElement;
      const chkAiAssistantEnable = document.getElementById('chk-ai-assistant-enable') as HTMLInputElement;
      const chkDynamicDeHarsh = document.getElementById('chk-dynamic-deharsh') as HTMLInputElement;
      const chkKickBassUnmask = document.getElementById('chk-kick-bass-unmask') as HTMLInputElement;
      const chkDolbyAtmosRoom = document.getElementById('chk-dolby-atmos-room') as HTMLInputElement;
      const chkTinyNeuralVocal = document.getElementById('chk-tiny-neural-vocal') as HTMLInputElement;

      lastMasterResult = await MasteringEngine.processMaster(audioBuffer, {
        album: activeAlbum,
        producer: activeProducer,
        inputSourceMode: selectInputSourceMode ? (selectInputSourceMode.value as any) : 'studio_demo',
        customDrive: parseFloat(sliderSat.value) / 100,
        customWidth: parseFloat(sliderWidth.value) / 100,
        intensityScale: parseFloat(sliderIntensity.value) / 100,
        streamingPlatform: selectStreamingTarget ? (selectStreamingTarget.value as any) : 'cd_metal',
        analogColorModel: selectAnalogTapeModel ? (selectAnalogTapeModel.value as any) : 'ampex_atr102',
        limiterMode: selectLimiterMode ? (selectLimiterMode.value as any) : 'soft_analog_clipper',
        realWorldDevice: selectRealWorldDevice ? (selectRealWorldDevice.value as any) : 'flat_studio',
        drumKitModelId: selectDrumKitModel ? selectDrumKitModel.value : 'bypass',
        guitarRigModelId: selectGuitarRigModel ? selectGuitarRigModel.value : 'bypass',
        bassRigModelId: selectBassRigModel ? selectBassRigModel.value : 'bypass',
        secretProducerHackId: selectSecretProducerHack ? selectSecretProducerHack.value : 'bypass',
        enableAiAssistant: chkAiAssistantEnable ? chkAiAssistantEnable.checked : true,
        enableDynamicDeHarsh: chkDynamicDeHarsh ? chkDynamicDeHarsh.checked : true,
        enableKickBassUnmask: chkKickBassUnmask ? chkKickBassUnmask.checked : true,
        enableDolbyAtmosRoom: chkDolbyAtmosRoom ? chkDolbyAtmosRoom.checked : false,
        enableTinyNeuralVocal: chkTinyNeuralVocal ? chkTinyNeuralVocal.checked : true,
        transientPunchAmount: sliderTransientPunch ? parseFloat(sliderTransientPunch.value) / 100 : 0.45,
        drumReplacementBlend: sliderDrumBlend ? parseFloat(sliderDrumBlend.value) / 100 : 0.0,
        guitarReampBlend: sliderGuitarBlend ? parseFloat(sliderGuitarBlend.value) / 100 : 0.0,
        bassReampBlend: sliderBassBlend ? parseFloat(sliderBassBlend.value) / 100 : 0.0,
        vocalModelBlend: sliderVocalBlend ? parseFloat(sliderVocalBlend.value) / 100 : 0.0,
        harmonyOptions: {
          guitarDoubling: selectGuitarDoubling ? (selectGuitarDoubling.value as any) : 'off',
          guitarHarmony: selectGuitarHarmony ? (selectGuitarHarmony.value as any) : 'none',
          bassDoubling: selectBassDoubling ? (selectBassDoubling.value as any) : 'off',
          vocalHarmony: selectVocalHarmony ? (selectVocalHarmony.value as any) : 'none',
        },
        pitchOptions: {
          enabled: chkPitchEnable ? chkPitchEnable.checked : false,
          rootKey: selectPitchRoot ? (selectPitchRoot.value as any) : 'C',
          scale: selectPitchScale ? (selectPitchScale.value as any) : 'chromatic',
          retuneSpeed: sliderRetuneSpeed ? parseFloat(sliderRetuneSpeed.value) / 100 : 0.65,
          amount: 0.85,
        },
        bitDepth: '24bit',
        onProgress: (pct, txt) => {
          masterProgressBar.style.width = `${pct}%`;
          masterProgressPct.textContent = `${pct}%`;
          masterProgressText.textContent = txt;
        }
      });

      // ─── LIVE AUDITION ENGINE WIRING ──────────────────────────────────────────
      const btnToggleLiveAudition = document.getElementById('btn-toggle-live-audition') as HTMLButtonElement;
      let isLiveAuditionActive = false;

      const updateAudition = () => {
        LiveRigAuditionEngine.updateLiveRig({
          enabled: isLiveAuditionActive,
          drumKitId: selectDrumKitModel?.value,
          guitarRigId: selectGuitarRigModel?.value,
          bassRigId: selectBassRigModel?.value,
          secretHackId: selectSecretProducerHack?.value,
        });
      };

      btnToggleLiveAudition?.addEventListener('click', () => {
        isLiveAuditionActive = !isLiveAuditionActive;
        btnToggleLiveAudition.textContent = isLiveAuditionActive ? '⚡ LIVE AUDITION: ON' : '⚡ LIVE AUDITION: OFF';
        btnToggleLiveAudition.classList.toggle('active-gold', isLiveAuditionActive);
        updateAudition();
      });

      selectDrumKitModel?.addEventListener('change', updateAudition);
      selectGuitarRigModel?.addEventListener('change', updateAudition);
      selectBassRigModel?.addEventListener('change', updateAudition);
      selectSecretProducerHack?.addEventListener('change', updateAudition);

      // ─── ALL-PLATFORM RELEASE BUNDLE EXPORTER ──────────────────────────────────
      const btnExportReleaseBundle = document.getElementById('btn-export-release-bundle') as HTMLButtonElement;
      const modalReleaseBundle = document.getElementById('modal-release-bundle')!;
      const releaseBundleList = document.getElementById('release-bundle-list')!;
      const btnCloseBundleModal = document.getElementById('btn-close-bundle-modal') as HTMLButtonElement;
      const btnDownloadAllBundle = document.getElementById('btn-download-all-bundle') as HTMLButtonElement;
      let generatedBundleItems: ReleaseFileItem[] = [];

      btnExportReleaseBundle?.addEventListener('click', async () => {
        if (!lastMasterResult) return;
        btnExportReleaseBundle.textContent = '⏳ Gerando Pacote de Lançamento...';
        btnExportReleaseBundle.disabled = true;

        try {
          const baseName = `MASTER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_${activeAlbum.albumTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          generatedBundleItems = await ReleaseBundleExportEngine.generateAllPlatformMasters(
            lastMasterResult.masterBuffer,
            baseName,
            lastMasterResult.reportHtml
          );

          releaseBundleList.innerHTML = generatedBundleItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #06090f; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: #ffffff;">${item.filename}</div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${item.description}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="font-size: 9px; background: rgba(245, 158, 11, 0.15); color: var(--gold-light); border: 1px solid var(--gold-primary); padding: 2px 6px; border-radius: 4px;">${item.badge}</span>
                <button type="button" class="btn-single-download switch-toggle-btn" data-filename="${item.filename}" style="padding: 4px 8px; font-size: 10px;">⬇️ Baixar</button>
              </div>
            </div>
          `).join('');

          releaseBundleList.querySelectorAll('.btn-single-download').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
              const item = generatedBundleItems[idx];
              if (!item) return;
              const url = URL.createObjectURL(item.blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = item.filename;
              a.click();
            });
          });

          modalReleaseBundle.classList.remove('hidden');
        } catch (e) {
          console.error('[ReleaseBundle] Generation error:', e);
        } finally {
          btnExportReleaseBundle.textContent = '📦 EXPORTAR PACOTE DE LANÇAMENTO (ALL PLATFORMS)';
          btnExportReleaseBundle.disabled = false;
        }
      });

      btnCloseBundleModal?.addEventListener('click', () => {
        modalReleaseBundle.classList.add('hidden');
      });

      btnDownloadAllBundle?.addEventListener('click', () => {
        generatedBundleItems.forEach(item => {
          const url = URL.createObjectURL(item.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.filename;
          a.click();
        });
      });

      // Update AI Diagnostic Scorecard
      const aiDiagCard = document.getElementById('ai-diagnostic-result-card');
      const diagScoreBadge = document.getElementById('diagnostic-score-badge');
      const diagIssuesList = document.getElementById('diagnostic-issues-list');
      if (lastMasterResult.diagnostic && aiDiagCard && diagScoreBadge && diagIssuesList) {
        aiDiagCard.classList.remove('hidden');
        diagScoreBadge.textContent = `Balanço: ${lastMasterResult.diagnostic.spectralBalanceScore}/100`;
        diagIssuesList.innerHTML = lastMasterResult.diagnostic.issues.map(iss => 
          `<div style="margin-top: 2px;">● <strong>${iss.description}</strong> → <span style="color: var(--emerald-primary);">${iss.correctionApplied}</span></div>`
        ).join('');
      }

      const stats = lastMasterResult.stats;
      meterIntLufs.textContent = `${(stats.integratedLufs ?? -14.0).toFixed(1)} LUFS`;
      meterTruePeak.textContent = `${(stats.truePeakDb ?? stats.peakDb ?? -0.3).toFixed(1)} dBFS`;
      meterCrest.textContent = `${(stats.crestFactorDb ?? 11.5).toFixed(1)} dB`;
      meterGrVal.textContent = '-3.2 dB';
      vuMeter.setValue(-3.2);
      vuMeterSec?.setValue(-3.2);

      const masterUrl = URL.createObjectURL(lastMasterResult.wavBlob);
      btnDownloadMaster.href = masterUrl;
      btnDownloadMaster.download = lastMasterResult.downloadFilename;
      btnDownloadMaster.classList.remove('hidden');

      const btnDownloadMp3 = document.getElementById('btn-download-mp3') as HTMLAnchorElement;
      if (btnDownloadMp3 && lastMasterResult) {
        const mp3Blob = Mp3EncoderEngine.encodeToMp3_320kbps(lastMasterResult.masterBuffer, {
          artist: activeAlbum.band,
          album: activeAlbum.albumTitle,
          title: `${activeAlbum.band} - ${activeAlbum.albumTitle} (Master 320k)`,
          year: '2026',
        });
        const mp3Url = URL.createObjectURL(mp3Blob);
        btnDownloadMp3.href = mp3Url;
        btnDownloadMp3.download = lastMasterResult.downloadFilename.replace('_24bit.wav', '_320kbps.mp3');
        btnDownloadMp3.classList.remove('hidden');
      }

      if (multiFormatExportWrap) multiFormatExportWrap.classList.remove('hidden');

      const btnGenerateCoverArt = document.getElementById('btn-generate-cover-art') as HTMLButtonElement;
      const modalCoverArt = document.getElementById('modal-cover-art')!;
      const coverArtCanvas = document.getElementById('cover-art-canvas') as HTMLCanvasElement;
      const btnDownloadCoverArt = document.getElementById('btn-download-cover-art') as HTMLAnchorElement;
      const btnCloseCoverModal = document.getElementById('btn-close-cover-modal') as HTMLButtonElement;

      if (btnGenerateCoverArt) {
        btnGenerateCoverArt.onclick = () => {
          CoverArtGenerator.renderCover(
            coverArtCanvas,
            activeAlbum.band,
            activeAlbum.albumTitle,
            activeProducer ? activeProducer.name : 'Master of Masters Studio Pro'
          );
          btnDownloadCoverArt.href = coverArtCanvas.toDataURL('image/png');
          btnDownloadCoverArt.download = `COVER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_4K.png`;
          modalCoverArt.classList.remove('hidden');
        };
      }

      btnCloseCoverModal?.addEventListener('click', () => {
        modalCoverArt.classList.add('hidden');
      });

      const btnGenerateSocialVideo = document.getElementById('btn-generate-social-video') as HTMLButtonElement;
      const modalSocialVideo = document.getElementById('modal-social-video')!;
      const socialVideoCanvas = document.getElementById('social-video-canvas') as HTMLCanvasElement;
      const btnRenderVideoTeaser = document.getElementById('btn-render-video-teaser') as HTMLButtonElement;
      const btnDownloadVideoTeaser = document.getElementById('btn-download-video-teaser') as HTMLAnchorElement;
      const btnCloseVideoModal = document.getElementById('btn-close-video-modal') as HTMLButtonElement;
      const videoRenderProgress = document.getElementById('video-render-progress')!;

      if (btnGenerateSocialVideo) {
        btnGenerateSocialVideo.onclick = () => {
          modalSocialVideo.classList.remove('hidden');
        };
      }

      btnCloseVideoModal?.addEventListener('click', () => {
        modalSocialVideo.classList.add('hidden');
      });

      if (btnRenderVideoTeaser) {
        btnRenderVideoTeaser.onclick = async () => {
          if (!lastMasterResult) return;
          btnRenderVideoTeaser.disabled = true;
          btnRenderVideoTeaser.textContent = '⏳ Renderizando Vídeo 4K...';
          
          try {
            const videoBlob = await SocialVideoTeaserGenerator.generateTeaserVideo(
              socialVideoCanvas,
              lastMasterResult.masterBuffer,
              {
                artist: activeAlbum.band,
                album: activeAlbum.albumTitle,
                producer: activeProducer ? activeProducer.name : 'Master of Masters Studio Pro',
              },
              (pct) => {
                videoRenderProgress.textContent = `Gravando vídeo: ${pct}% concluído...`;
              }
            );

            const videoUrl = URL.createObjectURL(videoBlob);
            btnDownloadVideoTeaser.href = videoUrl;
            btnDownloadVideoTeaser.download = `TEASER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_4K.mp4`;
            btnDownloadVideoTeaser.classList.remove('hidden');
            videoRenderProgress.textContent = '✅ Vídeo Teaser Renderizado com Sucesso!';
          } catch (vErr) {
            console.error('[VideoTeaser] Render error:', vErr);
            videoRenderProgress.textContent = '❌ Erro ao renderizar vídeo';
          } finally {
            btnRenderVideoTeaser.disabled = false;
            btnRenderVideoTeaser.textContent = '🎥 RENDERIZAR CLIPE COM VINIL GIRANDO E ESPECTRO';
          }
        };
      }

      if (btnExport32bit) {
        btnExport32bit.onclick = () => {
          if (!lastMasterResult) return;
          const blob32 = MultiFormatEncoder.encodeToFormat(lastMasterResult.masterBuffer, 'wav_32bit_float');
          const url32 = URL.createObjectURL(blob32);
          const a = document.createElement('a');
          a.href = url32;
          a.download = lastMasterResult.downloadFilename.replace('_24bit.wav', '_32bit_float.wav');
          a.click();
        };
      }

      if (btnExport16bit) {
        btnExport16bit.onclick = () => {
          if (!lastMasterResult) return;
          const blob16 = MultiFormatEncoder.encodeToFormat(lastMasterResult.masterBuffer, 'wav_16bit_cd');
          const url16 = URL.createObjectURL(blob16);
          const a = document.createElement('a');
          a.href = url16;
          a.download = lastMasterResult.downloadFilename.replace('_24bit.wav', '_16bit_cd.wav');
          a.click();
        };
      }

      const btnViewReport = document.getElementById('btn-view-report') as HTMLButtonElement;
      const modalMasterReport = document.getElementById('modal-master-report')!;
      const modalReportContent = document.getElementById('modal-report-content')!;
      const btnCloseReportModal = document.getElementById('btn-close-report-modal') as HTMLButtonElement;

      if (btnViewReport) {
        btnViewReport.classList.remove('hidden');
        btnViewReport.onclick = () => {
          if (!lastMasterResult) return;
          modalReportContent.innerHTML = lastMasterResult.reportHtml;
          modalMasterReport.classList.remove('hidden');
        };
      }

      if (btnCloseReportModal) {
        btnCloseReportModal.onclick = () => {
          modalMasterReport.classList.add('hidden');
        };
      }

      btnAbMaster.disabled = false;
      btnAbMaster.classList.remove('opacity-50', 'cursor-not-allowed', 'text-slate-500');
      btnAbMaster.classList.add('text-slate-300', 'active-gold');
      btnAbOrig.className = 'switch-toggle-btn';

      mainAudioPlayer.src = masterUrl;
      try {
        const p = mainAudioPlayer.play();
        if (p) {
          p.then(() => {
            btnTransportPlay.textContent = '❚❚';
          }).catch(pErr => {
            console.warn('[MasterStudio] Autoplay was blocked by browser, click play to listen:', pErr);
            btnTransportPlay.textContent = '▶';
          });
        }
      } catch (e) {
        console.warn('[MasterStudio] Audio play error:', e);
      }
    } catch (eErr: any) {
      console.error('[MasterStudio] Mastering failed:', eErr);
      masterProgressText.textContent = `❌ Erro: ${eErr.message || String(eErr)}`;
    } finally {
      btnProcessMaster.disabled = false;
      btnProcessMaster.classList.remove('opacity-50');
    }
  });

  // Preset Manager Handlers
  const selectUserPresets = document.getElementById('select-user-presets') as HTMLSelectElement;
  const btnSaveCurrentPreset = document.getElementById('btn-save-current-preset') as HTMLButtonElement;

  function refreshPresetsDropdown() {
    if (!selectUserPresets) return;
    const presets = PresetManager.getPresets();
    selectUserPresets.innerHTML = '<option value="">💾 Meus Presets Salvos...</option>';
    presets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${new Date(p.timestamp).toLocaleDateString()})`;
      selectUserPresets.appendChild(opt);
    });
  }

  refreshPresetsDropdown();

  btnSaveCurrentPreset?.addEventListener('click', () => {
    const name = prompt('Digite um nome para o seu Preset personalizado:', `${activeProducer.name} - ${activeAlbum.albumTitle} Custom`);
    if (!name) return;
    PresetManager.savePreset({
      name,
      producerId: activeProducer.id,
      albumId: activeAlbum.id,
      satDrive: parseFloat(sliderSat.value),
      stereoWidth: parseFloat(sliderWidth.value),
      intensity: parseFloat(sliderIntensity.value),
    });
    refreshPresetsDropdown();
    alert('✅ Preset salvo com sucesso no navegador!');
  });

  const btnBackupPresetsJson = document.getElementById('btn-backup-presets-json') as HTMLButtonElement;
  if (btnBackupPresetsJson) {
    btnBackupPresetsJson.addEventListener('click', () => {
      const blob = PresetBackupRestoreManager.exportPresetsToJson();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MASTER_OF_MASTERS_PRESETS_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });
  }

  const inputRestorePresetsJson = document.getElementById('input-restore-presets-json') as HTMLInputElement;
  if (inputRestorePresetsJson) {
    inputRestorePresetsJson.addEventListener('change', async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const res = await PresetBackupRestoreManager.importPresetsFromJson(file);
      alert(res.message);
      refreshPresetsDropdown();
    });
  }

  // ─── ALBUM BATCH MASTER MODAL WIRING ───────────────────────────────────────
  const btnOpenAlbumBatch = document.getElementById('btn-open-album-batch') as HTMLButtonElement;
  const modalAlbumBatch = document.getElementById('modal-album-batch')!;
  const btnCloseBatchModal = document.getElementById('btn-close-batch-modal') as HTMLButtonElement;
  const inputBatchFiles = document.getElementById('input-batch-files') as HTMLInputElement;
  const batchTracksList = document.getElementById('batch-tracks-list')!;
  const btnStartAlbumBatch = document.getElementById('btn-start-album-batch') as HTMLButtonElement;
  const batchProgressStatus = document.getElementById('batch-progress-status')!;

  let albumBatchQueue: AlbumTrackItem[] = [];

  if (btnOpenAlbumBatch) {
    btnOpenAlbumBatch.addEventListener('click', () => {
      modalAlbumBatch.classList.remove('hidden');
    });
  }

  btnCloseBatchModal?.addEventListener('click', () => {
    modalAlbumBatch.classList.add('hidden');
  });

  inputBatchFiles?.addEventListener('change', (e: any) => {
    const files: FileList = e.target?.files;
    if (!files || files.length === 0) return;

    albumBatchQueue = Array.from(files).map((f, idx) => ({
      id: `track-${idx}-${Date.now()}`,
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ''),
      status: 'PENDING',
    }));

    renderBatchList();
    btnStartAlbumBatch.disabled = albumBatchQueue.length === 0;
  });

  function renderBatchList() {
    if (albumBatchQueue.length === 0) {
      batchTracksList.innerHTML = '<div style="font-size: 11px; color: #64748b; text-align: center; padding: 20px;">Nenhuma faixa adicionada à fila ainda.</div>';
      return;
    }

    batchTracksList.innerHTML = albumBatchQueue.map((item, idx) => `
      <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: #f1f5f9;">
          <strong>${(idx + 1).toString().padStart(2, '0')}.</strong> ${item.title}
        </span>
        <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: ${item.status === 'COMPLETED' ? '#10b981' : item.status === 'PROCESSING' ? '#f59e0b' : '#94a3b8'};">
          ${item.status === 'COMPLETED' ? '✅ MASTERIZADO' : item.status === 'PROCESSING' ? '⏳ PROCESSANDO...' : 'PENDENTE'}
        </span>
      </div>
    `).join('');
  }

  btnStartAlbumBatch?.addEventListener('click', async () => {
    if (albumBatchQueue.length === 0) return;
    btnStartAlbumBatch.disabled = true;
    btnStartAlbumBatch.textContent = '⏳ Masterizando Ábum em Lote...';

    await AlbumBatchMasterEngine.processAlbumBatch(
      albumBatchQueue,
      activeAlbum,
      activeProducer,
      (tIdx, pct, msg) => {
        batchProgressStatus.textContent = `[Faixa ${tIdx + 1}/${albumBatchQueue.length}] ${pct}%: ${msg}`;
        renderBatchList();
      }
    );

    batchProgressStatus.textContent = '🎉 ÁLBUM COMPLETO MASTERIZADO COM SUCESSO!';
    btnStartAlbumBatch.disabled = false;
    btnStartAlbumBatch.textContent = '🚀 INICIAR MASTERIZAÇÃO EM LOTE DO ÁLBUM';

    // Download all completed tracks
    albumBatchQueue.forEach((track, i) => {
      if (track.result) {
        const url = URL.createObjectURL(track.result.wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(i + 1).toString().padStart(2, '0')}_${track.result.downloadFilename}`;
        a.click();
      }
    });
  });

  selectUserPresets?.addEventListener('change', () => {
    const id = selectUserPresets.value;
    if (!id) return;
    const presets = PresetManager.getPresets();
    const p = presets.find(item => item.id === id);
    if (!p) return;
    selectProducer(p.producerId, p.albumId);
    sliderSat.value = String(p.satDrive);
    sliderWidth.value = String(p.stereoWidth);
    sliderIntensity.value = String(p.intensity);
    knobMasterSat?.setValue(p.satDrive);
    knobMasterWidth?.setValue(p.stereoWidth);
    knobMasterIntensity?.setValue(p.intensity);
  });
}

// ─── WELDER ENGINE & INSTRUMENT CUSTOMIZERS ──────────────────────────────────
function setupWelderProcessing() {
  selectDrummerPreset.addEventListener('change', () => {
    const val = selectDrummerPreset.value;
    if (val === 'none') {
      drumSaturationDesc.textContent = `Saturação e kit calibrados do álbum selecionado (${activeAlbum.gemSetup.drums.saturation.toUpperCase()}).`;
    } else {
      drumSaturationDesc.textContent = `Kit de Baterista Ativo: ${selectDrummerPreset.options[selectDrummerPreset.selectedIndex].text}`;
    }
  });

  selectDrumSaturation.addEventListener('change', () => {
    const val = selectDrumSaturation.value;
    if (val === 'album_default') {
      drumSaturationDesc.textContent = `Saturação calibrada do álbum selecionado (${activeAlbum.gemSetup.drums.saturation.toUpperCase()}).`;
    } else {
      drumSaturationDesc.textContent = `Hardware ativo na Bateria: ${val.toUpperCase().replace('_', ' ')}.`;
    }
  });

  sliderDrumDrive.addEventListener('input', () => {
    labelDrumDrive.textContent = `${sliderDrumDrive.value}%`;
  });

  selectBassistPreset.addEventListener('change', () => {
    const val = selectBassistPreset.value;
    if (val === 'none') {
      bassSaturationDesc.textContent = `Timbre e amplificador calibrados do álbum selecionado (${activeAlbum.gemSetup.bass.saturation.toUpperCase()}).`;
    } else {
      bassSaturationDesc.textContent = `Assinatura de Baixista Ativa: ${selectBassistPreset.options[selectBassistPreset.selectedIndex].text}`;
    }
  });

  selectBassSaturation.addEventListener('change', () => {
    const val = selectBassSaturation.value;
    if (val === 'album_default') {
      bassSaturationDesc.textContent = `Timbre calibrado do álbum selecionado (${activeAlbum.gemSetup.bass.saturation.toUpperCase()}).`;
    } else {
      bassSaturationDesc.textContent = `Amplificador ativo no Baixo: ${val.toUpperCase().replace('_', ' ')}.`;
    }
  });

  sliderBassDrive.addEventListener('input', () => {
    labelBassDrive.textContent = `${sliderBassDrive.value}%`;
  });

  selectGuitarDistortion.addEventListener('change', () => {
    const val = selectGuitarDistortion.value;
    if (val === 'album_default') {
      guitarDistortionDesc.textContent = `Distorção calibrada do álbum selecionado (${activeAlbum.gemSetup.guitars.saturation.toUpperCase()}).`;
    } else {
      guitarDistortionDesc.textContent = `Amplificador/Pedal ativo nas Guitarras: ${val.toUpperCase().replace('_', ' ')}.`;
    }
  });

  sliderGuitarDrive.addEventListener('input', () => {
    labelGuitarDrive.textContent = `${sliderGuitarDrive.value}%`;
  });

  // ─── GEM MIXER & EDITOR CONTROLS ──────────────────────────────────────────
  const gemFaderVols = document.querySelectorAll<HTMLInputElement>('.gem-fader-vol');
  const gemFaderPans = document.querySelectorAll<HTMLInputElement>('.gem-fader-pan');
  const gemFaderTones = document.querySelectorAll<HTMLInputElement>('.gem-fader-tone');
  const btnMuteGems = document.querySelectorAll<HTMLButtonElement>('.btn-mute-gem');
  const btnExportStemGems = document.querySelectorAll<HTMLButtonElement>('.btn-export-stem-gem');

  const gemMixerState: Record<string, { volumeDb: number; pan: number; toneDb: number; mute: boolean; solo: boolean }> = {
    drums: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
    bass: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
    guitars: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
    vocals: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
    synthsFx: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
  };

  gemFaderVols.forEach(slider => {
    slider.addEventListener('input', () => {
      const gem = slider.getAttribute('data-gem')!;
      const val = parseFloat(slider.value);
      if (gemMixerState[gem]) gemMixerState[gem].volumeDb = val;
      const lbl = document.getElementById(`label-gem-vol-${gem}`);
      if (lbl) lbl.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)} dB`;
    });
  });

  gemFaderPans.forEach(slider => {
    slider.addEventListener('input', () => {
      const gem = slider.getAttribute('data-gem')!;
      const val = parseFloat(slider.value);
      if (gemMixerState[gem]) gemMixerState[gem].pan = val / 100;
      const lbl = document.getElementById(`label-gem-pan-${gem}`);
      if (lbl) {
        lbl.textContent = val === 0 ? 'C' : val < 0 ? `L ${Math.abs(val)}%` : `R ${val}%`;
      }
    });
  });

  gemFaderTones.forEach(slider => {
    slider.addEventListener('input', () => {
      const gem = slider.getAttribute('data-gem')!;
      const val = parseFloat(slider.value);
      if (gemMixerState[gem]) gemMixerState[gem].toneDb = val;
      const lbl = document.getElementById(`label-gem-tone-${gem}`);
      if (lbl) {
        lbl.textContent = val === 0 ? 'FLAT' : `${val >= 0 ? '+' : ''}${val.toFixed(1)} dB`;
      }
    });
  });

  btnSoloGems.forEach(btn => {
    btn.addEventListener('click', () => {
      const gem = btn.getAttribute('data-gem')!;
      if (gemMixerState[gem]) {
        gemMixerState[gem].solo = !gemMixerState[gem].solo;
        btn.classList.toggle('active-gold', gemMixerState[gem].solo);
      }
    });
  });

  btnMuteGems.forEach(btn => {
    btn.addEventListener('click', () => {
      const gem = btn.getAttribute('data-gem')!;
      if (gemMixerState[gem]) {
        gemMixerState[gem].mute = !gemMixerState[gem].mute;
        btn.classList.toggle('active-red', gemMixerState[gem].mute);
      }
    });
  });

  btnProcessWelder.addEventListener('click', async () => {
    if (!audioBuffer) return;
    btnProcessWelder.disabled = true;
    btnProcessWelder.classList.add('opacity-50');
    welderProgressWrap.classList.remove('hidden');

    try {
      const drummerPresetId = selectDrummerPreset.value === 'none' ? undefined : selectDrummerPreset.value;
      const bassistPresetId = selectBassistPreset.value === 'none' ? undefined : selectBassistPreset.value;

      const selectedDrumVal = selectDrumSaturation.value;
      const customDrumSaturation = selectedDrumVal === 'album_default' ? undefined : (selectedDrumVal as any);
      const customDrumDrive = (parseFloat(sliderDrumDrive.value) / 100) * activeAlbum.gemSetup.drums.drive;

      const selectedBassVal = selectBassSaturation.value;
      const customBassSaturation = selectedBassVal === 'album_default' ? undefined : (selectedBassVal as any);
      const customBassDrive = (parseFloat(sliderBassDrive.value) / 100) * activeAlbum.gemSetup.bass.drive;

      const selectedDistVal = selectGuitarDistortion.value;
      const customGuitarDistortion = selectedDistVal === 'album_default' ? undefined : (selectedDistVal as any);
      const customGuitarDrive = (parseFloat(sliderGuitarDrive.value) / 100) * activeAlbum.gemSetup.guitars.drive;

      lastWelderResult = await GemWelderEngine.processGemsAndWeld(
        audioBuffer,
        activeAlbum,
        {
          customGuitarDistortion,
          customGuitarDrive,
          customBassSaturation,
          customBassDrive,
          customDrumSaturation,
          customDrumDrive,
          drummerPresetId,
          bassistPresetId,
          gemFaders: gemMixerState,
          onProgress: (pct, txt) => {
            welderProgressBar.style.width = `${pct}%`;
            welderProgressPct.textContent = `${pct}%`;
            welderProgressText.textContent = txt;
          }
        }
      );

      btnExportStemGems.forEach(btn => {
        const gemKey = btn.getAttribute('data-gem');
        const gemRes = lastWelderResult?.individualGems.find(g => g.gemName === gemKey);
        if (gemRes) {
          btn.classList.remove('hidden');
          btn.onclick = () => {
            const url = URL.createObjectURL(gemRes.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `STEM_${activeAlbum.band}_${activeAlbum.albumTitle}_${gemKey}_24bit.wav`.replace(/[^a-zA-Z0-9_.-]/g, '_');
            a.click();
          };
        }
      });

      const weldedUrl = URL.createObjectURL(lastWelderResult.weldedWavBlob);
      btnDownloadWelded.href = weldedUrl;
      btnDownloadWelded.download = lastWelderResult.downloadFilename;
      btnDownloadWelded.classList.remove('hidden');
      welderStatusTag.textContent = 'SOLDAGEM FINAL CONCLUÍDA!';

      mainAudioPlayer.src = weldedUrl;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } catch (eErr: any) {
      console.error('[MasterStudio] Gem welding failed:', eErr);
      welderProgressText.textContent = `❌ Erro: ${eErr.message || String(eErr)}`;
    } finally {
      btnProcessWelder.disabled = false;
      btnProcessWelder.classList.remove('opacity-50');
    }
  });
}

// ─── VOCAL GOD MODULE ────────────────────────────────────────────────────────
function setupVocalModule() {
  vocalDropzone.addEventListener('click', () => vocalFileInput.click());
  vocalFileInput.addEventListener('change', async () => {
    const file = vocalFileInput.files?.[0];
    if (!file) return;
    vocalFileName.textContent = file.name;
    vocalFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`;
    vocalDropIdle.classList.add('hidden');
    vocalDropActive.classList.remove('hidden');

    try {
      const arr = await file.arrayBuffer();
      // @ts-ignore
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      vocalBuffer = await ctx.decodeAudioData(arr);
      vocalFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${(vocalBuffer.duration / 60).toFixed(1)} min · Pronto`;
      vocalAudioPlayer.src = URL.createObjectURL(file);
      vocalAudioPlayer.classList.remove('hidden');
      btnProcessVocal.disabled = false;
      btnProcessVocal.classList.remove('opacity-50', 'cursor-not-allowed');
    } catch (err) {
      vocalFileStats.textContent = '❌ Erro ao decodificar voz.';
    }
  });

  // ─── USER REAL VOICE TIMBRE CLONING ────────────────────────────────────────
  const userVoiceDropzone = document.getElementById('user-voice-dropzone');
  const userVoiceFileInput = document.getElementById('user-voice-file-input') as HTMLInputElement;
  const userVoiceIdle = document.getElementById('user-voice-idle');
  const userVoiceActive = document.getElementById('user-voice-active');
  const userVoiceName = document.getElementById('user-voice-name');
  const labelUserVoiceStatus = document.getElementById('label-user-voice-status');

  userVoiceDropzone?.addEventListener('click', () => userVoiceFileInput?.click());
  userVoiceFileInput?.addEventListener('change', async () => {
    const file = userVoiceFileInput.files?.[0];
    if (!file) return;
    if (userVoiceName) userVoiceName.textContent = file.name;
    userVoiceIdle?.classList.add('hidden');
    userVoiceActive?.classList.remove('hidden');

    try {
      const arr = await file.arrayBuffer();
      // @ts-ignore
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const userBuf = await ctx.decodeAudioData(arr);
      const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(userBuf);
      if (labelUserVoiceStatus) {
        labelUserVoiceStatus.textContent = `⚡ CLONE ATIVO (+${fp.singersFormantDb.toFixed(1)}dB Metal Power)`;
        labelUserVoiceStatus.style.color = 'var(--emerald-primary)';
      }
    } catch (e) {
      console.error('[VoiceCloner] Decode error:', e);
    }
  });

  selectVocalPreset.addEventListener('change', () => {
    const key = selectVocalPreset.value as VocalistPresetKey;
    const p = VOCALIST_PRESETS[key];
    if (p) {
      vocalPresetDesc.textContent = `${p.name}: ${p.signature}`;
      vocalSliderDeess.value = String(p.deEssAmount);
      vocalSliderAir.value = String(p.pultecAirDb);
      vocalSliderDoubler.value = String(p.doublerWidth);
      knobVocalDeess?.setValue(p.deEssAmount, false);
      knobVocalAir?.setValue(p.pultecAirDb, false);
      knobVocalDoubler?.setValue(p.doublerWidth, false);
    }
  });

  btnProcessVocal.addEventListener('click', async () => {
    const buf = vocalBuffer || audioBuffer;
    if (!buf) return;

    btnProcessVocal.disabled = true;
    vocalProgressWrap.classList.remove('hidden');

    try {
      const key = selectVocalPreset.value as VocalistPresetKey;
      const preset = VOCALIST_PRESETS[key] || VOCALIST_PRESETS.halford;

      const res = await VocalEngine.processVocal(buf, {
        preset,
        customDeEss: parseFloat(vocalSliderDeess.value),
        customAir: parseFloat(vocalSliderAir.value),
        customDoubler: parseFloat(vocalSliderDoubler.value),
        onProgress: (pct, txt) => {
          vocalProgressBar.style.width = `${pct}%`;
          vocalProgressPct.textContent = `${pct}%`;
          vocalProgressText.textContent = txt;
        }
      });

      const vUrl = URL.createObjectURL(res.wavBlob);
      btnDownloadVocal.href = vUrl;
      btnDownloadVocal.download = res.downloadFilename;
      btnDownloadVocal.classList.remove('hidden');

      mainAudioPlayer.src = vUrl;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } catch (err: any) {
      vocalProgressText.textContent = `❌ Erro: ${err.message || String(err)}`;
    } finally {
      btnProcessVocal.disabled = false;
    }
  });
}

// ─── 3D SPATIAL MODULE ───────────────────────────────────────────────────────
function setupSpatialModule() {
  renderSpatialRadar();
  renderSpatialChannels();

  selectSpatialPreset.addEventListener('change', () => {
    const p = SPATIAL_PRESETS.find(pr => pr.id === selectSpatialPreset.value);
    if (p) {
      spatialNodes = JSON.parse(JSON.stringify(p.nodes));
      renderSpatialRadar();
      renderSpatialChannels();
    }
  });

  btnResetSpatial.addEventListener('click', () => {
    spatialNodes = JSON.parse(JSON.stringify(SPATIAL_PRESETS[0].nodes));
    renderSpatialRadar();
    renderSpatialChannels();
  });

  spatialRadarCanvas.addEventListener('mousedown', (e) => {
    const rect = spatialRadarCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = spatialRadarCanvas.width;
    const h = spatialRadarCanvas.height;

    spatialNodes.forEach(node => {
      const nx = (node.x + 1) * 0.5 * w;
      const ny = node.y * (h * 0.85) + h * 0.08;
      const dist = Math.hypot(mx - nx, my - ny);
      if (dist < 18) {
        draggedNodeId = node.id;
      }
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!draggedNodeId) return;
    const rect = spatialRadarCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = spatialRadarCanvas.width;
    const h = spatialRadarCanvas.height;

    const node = spatialNodes.find(n => n.id === draggedNodeId);
    if (node) {
      node.x = Math.max(-1.0, Math.min(1.0, (mx / w) * 2 - 1));
      node.y = Math.max(0.0, Math.min(1.0, (my - h * 0.08) / (h * 0.85)));
      renderSpatialRadar();
      renderSpatialChannels();
    }
  });

  window.addEventListener('mouseup', () => {
    draggedNodeId = null;
  });

  btnProcessSpatial.addEventListener('click', async () => {
    if (!audioBuffer) return;
    btnProcessSpatial.disabled = true;
    spatialProgressWrap.classList.remove('hidden');

    try {
      const res = await SpatialEngine.renderSpatialMix(audioBuffer, spatialNodes, (pct, txt) => {
        spatialProgressBar.style.width = `${pct}%`;
        spatialProgressPct.textContent = `${pct}%`;
        spatialProgressText.textContent = txt;
      });

      const sUrl = URL.createObjectURL(res.wavBlob);
      btnDownloadSpatial.href = sUrl;
      btnDownloadSpatial.download = res.downloadFilename;
      btnDownloadSpatial.classList.remove('hidden');

      mainAudioPlayer.src = sUrl;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } catch (err: any) {
      spatialProgressText.textContent = `❌ Erro: ${err.message || String(err)}`;
    } finally {
      btnProcessSpatial.disabled = false;
    }
  });
}

function renderSpatialRadar() {
  const ctx = spatialRadarCanvas.getContext('2d')!;
  const w = spatialRadarCanvas.width;
  const h = spatialRadarCanvas.height;
  const cx = w / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    ctx.beginPath();
    ctx.arc(cx, h * 0.95, (w * 0.85) * r, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  }

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, h * 0.95, 8, 0, Math.PI * 2);
  ctx.fill();

  spatialNodes.forEach(node => {
    const nx = (node.x + 1) * 0.5 * w;
    const ny = node.y * (h * 0.85) + h * 0.08;

    ctx.fillStyle = node.color;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(nx, ny, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.name, nx - 20, ny - 14);
  });
}

function renderSpatialChannels() {
  spatialChannelsContainer.innerHTML = '';
  spatialNodes.forEach(node => {
    const panPct = Math.round(node.x * 100);
    const panStr = panPct === 0 ? 'CENTRO' : panPct < 0 ? `L ${Math.abs(panPct)}%` : `R ${panPct}%`;
    const distStr = `${Math.round(node.y * 100)}% PROFUNDIDADE`;

    const row = document.createElement('div');
    row.className = 'p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between';
    row.innerHTML = `
      <span class="font-bold" style="color: ${node.color}">${node.name}</span>
      <div class="flex items-center gap-3 text-[10px]">
        <span class="text-slate-300">Pan: <strong class="text-amber-400">${panStr}</strong></span>
        <span class="text-slate-400">Dist: <strong>${distStr}</strong></span>
      </div>
    `;
    spatialChannelsContainer.appendChild(row);
  });
}

// ─── AI REFERENCE MATCH MODULE ───────────────────────────────────────────────
function setupAiMatchModule() {
  aiTargetDropzone.addEventListener('click', () => aiTargetFileInput.click());
  aiTargetFileInput.addEventListener('change', async () => {
    const file = aiTargetFileInput.files?.[0];
    if (!file) return;
    aiTargetTitle.textContent = file.name;
    aiTargetInfo.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`;

    try {
      const arr = await file.arrayBuffer();
      // @ts-ignore
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      aiTargetBuffer = await ctx.decodeAudioData(arr);
      aiTargetInfo.textContent = `${(aiTargetBuffer.duration / 60).toFixed(1)} min · Decodificado`;
      checkAiReady();
    } catch (e) {
      aiTargetInfo.textContent = '❌ Erro ao decodificar.';
    }
  });

  aiRefDropzone.addEventListener('click', () => aiRefFileInput.click());
  aiRefFileInput.addEventListener('change', async () => {
    const file = aiRefFileInput.files?.[0];
    if (!file) return;
    aiRefTitle.textContent = file.name;
    aiRefInfo.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`;

    try {
      const arr = await file.arrayBuffer();
      // @ts-ignore
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      aiRefBuffer = await ctx.decodeAudioData(arr);
      aiRefInfo.textContent = `${(aiRefBuffer.duration / 60).toFixed(1)} min · Decodificado`;
      checkAiReady();
    } catch (e) {
      aiRefInfo.textContent = '❌ Erro ao decodificar.';
    }
  });

  function checkAiReady() {
    if (aiTargetBuffer && aiRefBuffer) {
      btnRunAiMatch.disabled = false;
      btnRunAiMatch.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  btnRunAiMatch.addEventListener('click', async () => {
    if (!aiTargetBuffer || !aiRefBuffer) return;
    btnRunAiMatch.disabled = true;
    aiProgressWrap.classList.remove('hidden');

    try {
      const res = await AiMatchEngine.matchToReference(aiTargetBuffer, aiRefBuffer, (pct, txt) => {
        aiProgressBar.style.width = `${pct}%`;
        aiProgressPct.textContent = `${pct}%`;
        aiProgressText.textContent = txt;
      });

      const mUrl = URL.createObjectURL(res.wavBlob);
      btnDownloadAiMatch.href = mUrl;
      btnDownloadAiMatch.download = res.downloadFilename;
      btnDownloadAiMatch.classList.remove('hidden');

      mainAudioPlayer.src = mUrl;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
    } catch (err: any) {
      aiProgressText.textContent = `❌ Erro: ${err.message || String(err)}`;
    } finally {
      btnRunAiMatch.disabled = false;
    }
  });
}

// ─── BATCH PROCESSOR ─────────────────────────────────────────────────────────
function setupBatchProcessing() {
  batchDropzone.addEventListener('click', () => batchFileInput.click());
  batchFileInput.addEventListener('change', () => {
    const files = Array.from(batchFileInput.files || []);
    if (files.length > 0) {
      batchFiles = files;
      renderBatchList();
    }
  });

  btnRunBatch.addEventListener('click', async () => {
    if (batchFiles.length === 0) return;
    btnRunBatch.disabled = true;
    // @ts-ignore
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    for (let i = 0; i < batchFiles.length; i++) {
      const f = batchFiles[i];
      const itemEl = document.getElementById(`batch-item-${i}`);
      const statusEl = itemEl?.querySelector('.batch-status');
      if (statusEl) statusEl.textContent = 'Processando...';

      try {
        const arr = await f.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        const res = await MasteringEngine.processMaster(buf, {
          album: activeAlbum,
          bitDepth: '24bit',
        });

        if (statusEl) {
          statusEl.innerHTML = `<a href="${URL.createObjectURL(res.wavBlob)}" download="${res.downloadFilename}" class="text-emerald-400 font-bold underline">⬇️ Baixar WAV</a>`;
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ Falha';
      }
    }
    btnRunBatch.disabled = false;
  });
}

function renderBatchList() {
  batchList.innerHTML = '';
  batchFiles.forEach((file, idx) => {
    const div = document.createElement('div');
    div.id = `batch-item-${idx}`;
    div.className = 'p-3 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center text-xs font-mono';
    div.innerHTML = `
      <span class="text-slate-200 font-bold">${idx + 1}. ${file.name}</span>
      <span class="batch-status text-slate-400">Pendente (${(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
    `;
    batchList.appendChild(div);
  });
  btnRunBatch.disabled = false;
  btnRunBatch.classList.remove('opacity-50', 'cursor-not-allowed');
}

// ─── SONG ARRANGER & TIMELINE DAW MODULE ─────────────────────────────────────
let currentSections: SongSection[] = [];
let lastArrangedResult: any = null;

function setupArrangerModule() {
  const btnOpenModal = document.getElementById('btn-open-new-section-modal');
  const btnCloseModal = document.getElementById('btn-close-new-section-modal');
  const modalNewSection = document.getElementById('modal-new-section');
  const btnConfirmAdd = document.getElementById('btn-confirm-add-section');
  const btnAutoDetect = document.getElementById('btn-auto-detect-sections');
  const btnReset = document.getElementById('btn-reset-arrangement');
  const btnProcessArranger = document.getElementById('btn-process-arranger') as HTMLButtonElement;
  const btnDownloadArranged = document.getElementById('btn-download-arranged') as HTMLAnchorElement;
  const arrangerProgressBar = document.getElementById('arranger-progress-bar') as HTMLDivElement;
  const arrangerProgressPct = document.getElementById('arranger-progress-pct') as HTMLSpanElement;
  const arrangerProgressText = document.getElementById('arranger-progress-text') as HTMLSpanElement;
  const arrangerProgressWrap = document.getElementById('arranger-progress-wrap') as HTMLDivElement;

  btnOpenModal?.addEventListener('click', () => {
    modalNewSection?.classList.remove('hidden');
  });

  btnCloseModal?.addEventListener('click', () => {
    modalNewSection?.classList.add('hidden');
  });

  btnAutoDetect?.addEventListener('click', () => {
    if (!audioBuffer) return;
    currentSections = SongArrangerEngine.autoDetectSections(audioBuffer.duration);
    renderArrangerTimelineUI();
  });

  btnReset?.addEventListener('click', () => {
    if (!audioBuffer) return;
    currentSections = SongArrangerEngine.autoDetectSections(audioBuffer.duration);
    renderArrangerTimelineUI();
  });

  btnConfirmAdd?.addEventListener('click', () => {
    if (!audioBuffer) return;
    const nameInput = document.getElementById('input-new-section-name') as HTMLInputElement;
    const durSelect = document.getElementById('select-new-section-dur') as HTMLSelectElement;
    const posSelect = document.getElementById('select-new-section-pos') as HTMLSelectElement;
    const chkDrums = (document.getElementById('chk-gem-drums') as HTMLInputElement)?.checked ?? true;
    const chkBass = (document.getElementById('chk-gem-bass') as HTMLInputElement)?.checked ?? true;
    const chkGuitars = (document.getElementById('chk-gem-guitars') as HTMLInputElement)?.checked ?? true;
    const chkVocals = (document.getElementById('chk-gem-vocals') as HTMLInputElement)?.checked ?? false;
    const chkSynths = (document.getElementById('chk-gem-synths') as HTMLInputElement)?.checked ?? true;

    const secDur = parseFloat(durSelect.value) || 30;
    const name = nameInput.value.trim() || 'NOVA SEÇÃO';
    
    // Choose reference start time from chorus or verse
    const refStart = audioBuffer.duration > 60 ? audioBuffer.duration * 0.4 : 0;
    const newSec: SongSection = {
      id: `sec_custom_${Date.now()}`,
      name: `★ ${name}`,
      color: '#f59e0b',
      startTime: refStart,
      endTime: Math.min(audioBuffer.duration, refStart + secDur),
      repeatCount: 1,
      activeGems: {
        drums: chkDrums,
        bass: chkBass,
        guitars: chkGuitars,
        vocals: chkVocals,
        synths: chkSynths,
      },
      speedMultiplier: 1.0,
    };

    if (posSelect.value === 'start') {
      currentSections.unshift(newSec);
    } else if (posSelect.value === 'after_chorus') {
      const chorusIdx = currentSections.findIndex(s => s.name.toLowerCase().includes('refrão') || s.name.toLowerCase().includes('chorus'));
      if (chorusIdx !== -1) {
        currentSections.splice(chorusIdx + 1, 0, newSec);
      } else {
        currentSections.push(newSec);
      }
    } else {
      currentSections.push(newSec);
    }

    modalNewSection?.classList.add('hidden');
    renderArrangerTimelineUI();
  });

  btnProcessArranger?.addEventListener('click', async () => {
    if (!audioBuffer) return;
    btnProcessArranger.disabled = true;
    btnProcessArranger.classList.add('opacity-50');
    arrangerProgressWrap.classList.remove('hidden');

    try {
      lastArrangedResult = await SongArrangerEngine.renderArrangement(
        audioBuffer,
        currentSections,
        (pct, txt) => {
          arrangerProgressBar.style.width = `${pct}%`;
          arrangerProgressPct.textContent = `${pct}%`;
          arrangerProgressText.textContent = txt;
        }
      );

      const url = URL.createObjectURL(lastArrangedResult.arrangedWavBlob);
      btnDownloadArranged.href = url;
      btnDownloadArranged.download = lastArrangedResult.downloadFilename;
      btnDownloadArranged.classList.remove('hidden');

      // Update global audioBuffer so other consoles can master the arranged song!
      audioBuffer = lastArrangedResult.arrangedBuffer;
      loadedFileName.textContent = `[ARRANJADO] ${loadedFile ? loadedFile.name : 'audio.wav'}`;
      mainAudioPlayer.src = url;
      mainAudioPlayer.play();
      btnTransportPlay.textContent = '❚❚';
      btnProcessMaster.disabled = false;
    } catch (err: any) {
      console.error('[MasterStudio] Arranger rendering failed:', err);
      arrangerProgressText.textContent = `❌ Erro: ${err.message || String(err)}`;
    } finally {
      btnProcessArranger.disabled = false;
      btnProcessArranger.classList.remove('opacity-50');
    }
  });
}

function initArrangerWithAudio(buf: AudioBuffer) {
  currentSections = SongArrangerEngine.autoDetectSections(buf.duration);
  const btnProcessArranger = document.getElementById('btn-process-arranger') as HTMLButtonElement;
  if (btnProcessArranger) {
    btnProcessArranger.disabled = false;
    btnProcessArranger.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  renderArrangerTimelineUI();
}

function renderArrangerTimelineUI() {
  const container = document.getElementById('arranger-timeline-grid');
  const origDurEl = document.getElementById('arranger-orig-dur');
  const newDurEl = document.getElementById('arranger-new-dur');
  const countEl = document.getElementById('arranger-total-sections');

  if (!container) return;
  container.innerHTML = '';

  let totalNewSeconds = 0;
  currentSections.forEach(s => {
    const dur = Math.max(0, s.endTime - s.startTime);
    totalNewSeconds += dur * s.repeatCount;
  });

  if (origDurEl && audioBuffer) {
    const oM = Math.floor(audioBuffer.duration / 60);
    const oS = Math.floor(audioBuffer.duration % 60).toString().padStart(2, '0');
    origDurEl.textContent = `${oM}:${oS}`;
  }

  if (newDurEl) {
    const nM = Math.floor(totalNewSeconds / 60);
    const nS = Math.floor(totalNewSeconds % 60).toString().padStart(2, '0');
    newDurEl.textContent = `${nM}:${nS}`;
  }

  if (countEl) countEl.textContent = String(currentSections.length);

  currentSections.forEach((sec, idx) => {
    const card = document.createElement('div');
    card.className = 'studio-card';
    card.style.borderLeft = `4px solid ${sec.color}`;
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '8px';

    const sM = Math.floor(sec.startTime / 60);
    const sS = Math.floor(sec.startTime % 60).toString().padStart(2, '0');
    const eM = Math.floor(sec.endTime / 60);
    const eS = Math.floor(sec.endTime % 60).toString().padStart(2, '0');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span style="font-family: var(--font-display); font-size: 13px; font-weight: 800; color: ${sec.color}; text-transform: uppercase;">
          ${idx + 1}. ${sec.name}
        </span>
        <button type="button" class="switch-toggle-btn btn-del-sec" data-id="${sec.id}" style="padding: 2px 6px; font-size: 10px; color: var(--red-light);" title="Remover Seção">🗑️</button>
      </div>

      <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: #94a3b8;">
        <span>Posição Original:</span>
        <strong style="color: #cbd5e1;">${sM}:${sS} ➔ ${eM}:${eS}</strong>
      </div>

      <!-- REPEAT / LENGTHEN CONTROLS -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #06090f; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--gold-light); font-weight: 700;">REPETIÇÕES:</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="switch-toggle-btn btn-sec-minus" data-id="${sec.id}" style="padding: 2px 8px; font-size: 10px;">-</button>
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #ffffff;">${sec.repeatCount}x</span>
          <button type="button" class="switch-toggle-btn btn-sec-plus" data-id="${sec.id}" style="padding: 2px 8px; font-size: 10px;">+</button>
        </div>
      </div>

      <!-- ACTIVE GEMS BADGES -->
      <div style="display: flex; gap: 4px; font-family: var(--font-mono); font-size: 9px; flex-wrap: wrap;">
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.drums ? 'rgba(245, 158, 11, 0.2)' : '#1e293b'}; color: ${sec.activeGems.drums ? 'var(--gold-light)' : '#64748b'};">🥁 Bat</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.bass ? 'rgba(168, 85, 247, 0.2)' : '#1e293b'}; color: ${sec.activeGems.bass ? 'var(--purple-primary)' : '#64748b'};">🎸 Baixo</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.guitars ? 'rgba(251, 146, 60, 0.2)' : '#1e293b'}; color: ${sec.activeGems.guitars ? '#fb923c' : '#64748b'};">⚡ Gtr</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.vocals ? 'rgba(6, 182, 212, 0.2)' : '#1e293b'}; color: ${sec.activeGems.vocals ? 'var(--cyan-light)' : '#64748b'};">🎤 Voz</span>
      </div>

      <!-- DUPLICATE & SPLIT BUTTONS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 2px;">
        <button type="button" class="switch-toggle-btn btn-duplicate-sec" data-id="${sec.id}" style="font-size: 10px; padding: 4px;">2x Duplicar</button>
        <button type="button" class="switch-toggle-btn btn-halve-sec" data-id="${sec.id}" style="font-size: 10px; padding: 4px;">✂️ Encurtar 50%</button>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach event handlers to card buttons
  container.querySelectorAll('.btn-sec-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const s = currentSections.find(sec => sec.id === id);
      if (s) { s.repeatCount++; renderArrangerTimelineUI(); }
    });
  });

  container.querySelectorAll('.btn-sec-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const s = currentSections.find(sec => sec.id === id);
      if (s && s.repeatCount > 1) { s.repeatCount--; renderArrangerTimelineUI(); }
    });
  });

  container.querySelectorAll('.btn-duplicate-sec').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const s = currentSections.find(sec => sec.id === id);
      if (s) {
        const idx = currentSections.indexOf(s);
        const clone: SongSection = { ...s, id: `sec_clone_${Date.now()}`, name: `${s.name} (COPIA)` };
        currentSections.splice(idx + 1, 0, clone);
        renderArrangerTimelineUI();
      }
    });
  });

  container.querySelectorAll('.btn-halve-sec').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const s = currentSections.find(sec => sec.id === id);
      if (s) {
        const dur = s.endTime - s.startTime;
        s.endTime = s.startTime + dur * 0.5;
        renderArrangerTimelineUI();
      }
    });
  });

  container.querySelectorAll('.btn-del-sec').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      currentSections = currentSections.filter(sec => sec.id !== id);
      renderArrangerTimelineUI();
    });
  });
}

// ─── RUN ON DOM LOAD ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
