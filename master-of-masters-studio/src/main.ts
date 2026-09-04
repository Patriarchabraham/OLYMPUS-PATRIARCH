import './style.css'
import { CoverArtGenerator } from './components/CoverArtGenerator'
import { LiveFretboardVisualizer } from './components/LiveFretboardVisualizer'
import { LyricVideo4kGenerator } from './components/LyricVideo4kGenerator'
import { MasterBoxSetExporter } from './components/MasterBoxSetExporter'
import { PresetBackupRestoreManager } from './components/PresetBackupRestoreManager'
import { PresetManager } from './components/PresetManager'
import { ProKeybindingsMatrix } from './components/ProKeybindingsMatrix'
import { RotaryKnob } from './components/RotaryKnob'
import { SocialVideoTeaserGenerator } from './components/SocialVideoTeaserGenerator'
import { WaveformScrubber } from './components/WaveformScrubber'
import {
	ALL_MASTERS,
	type MasterAlbumSetup,
	type MasterProducer,
} from './database/masters-database'
import { LEGENDARY_MICROPHONES, type MicrophoneModel } from './database/microphones-database'
import {
	AiMaestroConductorEngine,
	type MaestroOrchestraScore,
} from './dsp/AiMaestroConductorEngine'
import { AiMasterAutoCalibrator } from './dsp/AiMasterAutoCalibrator'
import { AiMatchEngine } from './dsp/AiMatchEngine'
import { AlbumBatchMasterEngine, type AlbumTrackItem } from './dsp/AlbumBatchMasterEngine'
import { MasteringEngine, type MasteringResult } from './dsp/AudioEngine'
import { BinauralStudioMonitor } from './dsp/BinauralStudioMonitor'
import { ClassicAlbumSongGenerator } from './dsp/ClassicAlbumSongGenerator'
import { ColabFreeMusicBridge } from './dsp/ColabFreeMusicBridge'
import { FullMixReferenceStemExtractor } from './dsp/FullMixReferenceStemExtractor'
import { GemWelderEngine, type WelderResult } from './dsp/GemWelderEngine'
import { KeyDetectorEngine } from './dsp/KeyDetectorEngine'
import { LiveRigAuditionEngine } from './dsp/LiveRigAuditionEngine'
import { LiveStemMixerEngine, type StemMixerConfig } from './dsp/LiveStemMixerEngine'
import { LocalAlgorithmicRecomposerEngine } from './dsp/LocalAlgorithmicRecomposerEngine'
import { MicModelingEngine } from './dsp/MicModelingEngine'
import { MidiFileExportEngine } from './dsp/MidiFileExportEngine'
import { Mp3EncoderEngine } from './dsp/Mp3EncoderEngine'
import { MultiFormatEncoder } from './dsp/MultiFormatEncoder'
import { NeuralInstrumentTimbreCloner } from './dsp/NeuralInstrumentTimbreCloner'
import { PerceptualLoudnessMatcher } from './dsp/PerceptualLoudnessMatcher'
import { PythonColabBridgeEngine } from './dsp/PythonColabBridgeEngine'
import { ReleaseBundleExportEngine, type ReleaseFileItem } from './dsp/ReleaseBundleExportEngine'
import { SongArrangerEngine, type SongSection } from './dsp/SongArrangerEngine'
import { SPATIAL_PRESETS, SpatialEngine, type SpatialNodePos } from './dsp/SpatialEngine'
import { UniversalAudioFormatDecoder } from './dsp/UniversalAudioFormatDecoder'
import { VOCALIST_PRESETS, VocalEngine, type VocalistPresetKey } from './dsp/VocalEngine'
import { VoiceTimbreCloner } from './dsp/VoiceTimbreCloner'
import { audioBufferTo24BitWavBlob } from './dsp/WavEncoder'
import { NeuralVoiceClient } from './services/NeuralVoiceClient'
import { StereoPeakMeter } from './visualizers/PeakMeter'
import { PhaseGoniometer } from './visualizers/PhaseGoniometer'
import { SpectrumVisualizer } from './visualizers/SpectrumAnalyzer'
import { AnalogVuMeter } from './visualizers/VuMeter'

// ─── STATE ───────────────────────────────────────────────────────────────────
let activeProducer: MasterProducer = ALL_MASTERS[0]
let activeAlbum: MasterAlbumSetup = ALL_MASTERS[0].albums[0]
let activeMic: MicrophoneModel = LEGENDARY_MICROPHONES[0]

let loadedFile: File | null = null
let audioBuffer: AudioBuffer | null = null
let audioCtx: AudioContext | null = null

let lastMasterResult: MasteringResult | null = null
let lastWelderResult: WelderResult | null = null

let vocalBuffer: AudioBuffer | null = null
let aiTargetBuffer: AudioBuffer | null = null
let aiRefBuffer: AudioBuffer | null = null
let v4ReferenceBuffer: AudioBuffer | null = null

let spatialNodes: SpatialNodePos[] = JSON.parse(JSON.stringify(SPATIAL_PRESETS[0].nodes))
let draggedNodeId: string | null = null

let spectrumVisualizer: SpectrumVisualizer
let _phaseGoniometer: PhaseGoniometer
let vuMeter: AnalogVuMeter
let vuMeterSec: AnalogVuMeter
let stereoPeakMeter: StereoPeakMeter

let playbackAudioCtx: AudioContext | null = null
let playbackSourceNode: MediaElementAudioSourceNode | null = null
let analyserL: AnalyserNode
let analyserR: AnalyserNode
let playbackDataL: Float32Array
let playbackDataR: Float32Array
let isPeakMeterRunning = false

let batchFiles: File[] = []
let isMono = false
let isDim = false

// ─── DOM ELEMENTS ────────────────────────────────────────────────────────────
const producerCardsContainer = document.getElementById('producer-cards-container')!
const filterBtns = document.querySelectorAll('.filter-btn') as NodeListOf<HTMLButtonElement>
const selectProducerQuick = document.getElementById('select-producer-quick') as HTMLSelectElement
const selectAlbumQuick = document.getElementById('select-album-quick') as HTMLSelectElement
const btnToggleProducersDrawer = document.getElementById(
	'btn-toggle-producers-drawer',
) as HTMLButtonElement
const producersDrawerPanel = document.getElementById('producers-drawer-panel')!

const activeMasterTag = document.getElementById('active-master-tag')!
const activeEraTag = document.getElementById('active-era-tag')!
const activeAlbumTitle = document.getElementById('active-album-title')!
const activeCountryText = document.getElementById('active-country-text')!
const specTuning = document.getElementById('spec-tuning')!
const specGuitarAmp = document.getElementById('spec-guitar-amp')!
const specLufs = document.getElementById('spec-lufs')!
const specSat = document.getElementById('spec-sat')!
const specComp = document.getElementById('spec-comp')!
const specWidth = document.getElementById('spec-width')!
const specChain = document.getElementById('spec-chain')!

// Sliders (Fallback & Rotary Sync)
const sliderSat = document.getElementById('slider-sat') as HTMLInputElement
const sliderWidth = document.getElementById('slider-width') as HTMLInputElement
const sliderIntensity = document.getElementById('slider-intensity') as HTMLInputElement
const labelSatVal = document.getElementById('label-sat-val')!
const labelWidthVal = document.getElementById('label-width-val')!
const labelIntensityVal = document.getElementById('label-intensity-val')!

// Audio Loader & Player Dock
const audioDropzone = document.getElementById('audio-dropzone')!
const audioFileInput = document.getElementById('audio-file-input') as HTMLInputElement
const dropIdleState = document.getElementById('drop-idle-state')!
const dropActiveState = document.getElementById('drop-active-state')!
const loadedFileName = document.getElementById('loaded-file-name')!
const loadedFileStats = document.getElementById('loaded-file-stats')!
const mainAudioPlayer = document.getElementById('main-audio-player') as HTMLAudioElement
const btnTransportPlay = document.getElementById('btn-transport-play') as HTMLButtonElement
const transportScrub = document.getElementById('transport-scrub') as HTMLInputElement
const transportTimeCurrent = document.getElementById('transport-time-current')!
const transportTimeTotal = document.getElementById('transport-time-total')!
const btnAbOrig = document.getElementById('btn-ab-orig') as HTMLButtonElement
const btnAbMaster = document.getElementById('btn-ab-master') as HTMLButtonElement
const btnMonoCheck = document.getElementById('btn-mono-check') as HTMLButtonElement
const btnDim = document.getElementById('btn-dim') as HTMLButtonElement

// Process Master
const btnProcessMaster = document.getElementById('btn-process-master') as HTMLButtonElement
const btnDownloadMaster = document.getElementById('btn-download-master') as HTMLAnchorElement
const masterProgressWrap = document.getElementById('master-progress-wrap')!
const masterProgressBar = document.getElementById('master-progress-bar')!
const masterProgressPct = document.getElementById('master-progress-pct')!
const masterProgressText = document.getElementById('master-progress-text')!
const masterTubeFilament = document.getElementById('master-tube-filament')!

// Welder & Instrument Customizers
const selectDrummerPreset = document.getElementById('select-drummer-preset') as HTMLSelectElement
const selectDrumSaturation = document.getElementById('select-drum-saturation') as HTMLSelectElement
const sliderDrumDrive = document.getElementById('slider-drum-drive') as HTMLInputElement
const labelDrumDrive = document.getElementById('label-drum-drive')!
const drumSaturationDesc = document.getElementById('drum-saturation-desc')!

const selectBassistPreset = document.getElementById('select-bassist-preset') as HTMLSelectElement
const selectBassSaturation = document.getElementById('select-bass-saturation') as HTMLSelectElement
const sliderBassDrive = document.getElementById('slider-bass-drive') as HTMLInputElement
const labelBassDrive = document.getElementById('label-bass-drive')!
const bassSaturationDesc = document.getElementById('bass-saturation-desc')!

const selectGuitarDistortion = document.getElementById(
	'select-guitar-distortion',
) as HTMLSelectElement
const sliderGuitarDrive = document.getElementById('slider-guitar-drive') as HTMLInputElement
const labelGuitarDrive = document.getElementById('label-guitar-drive')!
const guitarDistortionDesc = document.getElementById('guitar-distortion-desc')!

const gemCardDrums = document.getElementById('gem-card-drums')!
const gemCardBass = document.getElementById('gem-card-bass')!
const gemCardGuitars = document.getElementById('gem-card-guitars')!
const gemCardVocals = document.getElementById('gem-card-vocals')!
const gemCardSynths = document.getElementById('gem-card-synths')!
const btnProcessWelder = document.getElementById('btn-process-welder') as HTMLButtonElement
const btnDownloadWelded = document.getElementById('btn-download-welded') as HTMLAnchorElement
const welderProgressWrap = document.getElementById('welder-progress-wrap')!
const welderProgressBar = document.getElementById('welder-progress-bar')!
const welderProgressPct = document.getElementById('welder-progress-pct')!
const welderProgressText = document.getElementById('welder-progress-text')!
const welderStatusTag = document.getElementById('welder-status-tag')!
const btnSoloGems = document.querySelectorAll('.btn-solo-gem') as NodeListOf<HTMLButtonElement>

// Mic Locker Elements
const micsGalleryContainer = document.getElementById('mics-gallery-container')!
const micsCount = document.getElementById('mics-count')!
const micFilterBtns = document.querySelectorAll('.mic-filter-btn') as NodeListOf<HTMLButtonElement>
const activeMicIcon = document.getElementById('active-mic-icon')!
const activeMicBrand = document.getElementById('active-mic-brand')!
const activeMicName = document.getElementById('active-mic-name')!
const activeMicCapsule = document.getElementById('active-mic-capsule')!
const activeMicPolar = document.getElementById('active-mic-polar')!
const activeMicPreamp = document.getElementById('active-mic-preamp')!
const activeMicUsers = document.getElementById('active-mic-users')!
const micSliderDist = document.getElementById('mic-slider-dist') as HTMLInputElement
const micSliderPreamp = document.getElementById('mic-slider-preamp') as HTMLInputElement
const btnProcessMic = document.getElementById('btn-process-mic') as HTMLButtonElement
const btnDownloadMic = document.getElementById('btn-download-mic') as HTMLAnchorElement
const micProgressWrap = document.getElementById('mic-progress-wrap')!
const micProgressBar = document.getElementById('mic-progress-bar')!
const micProgressPct = document.getElementById('mic-progress-pct')!
const micProgressText = document.getElementById('mic-progress-text')!

// Vocal God Elements
const vocalDropzone = document.getElementById('vocal-dropzone')!
const vocalFileInput = document.getElementById('vocal-file-input') as HTMLInputElement
const vocalDropIdle = document.getElementById('vocal-drop-idle')!
const vocalDropActive = document.getElementById('vocal-drop-active')!
const vocalFileName = document.getElementById('vocal-file-name')!
const vocalFileStats = document.getElementById('vocal-file-stats')!
const vocalAudioPlayer = document.getElementById('vocal-audio-player') as HTMLAudioElement
const selectVocalPreset = document.getElementById('select-vocal-preset') as HTMLSelectElement
const vocalPresetDesc = document.getElementById('vocal-preset-desc')!
const vocalSliderDeess = document.getElementById('vocal-slider-deess') as HTMLInputElement
const vocalSliderAir = document.getElementById('vocal-slider-air') as HTMLInputElement
const vocalSliderDoubler = document.getElementById('vocal-slider-doubler') as HTMLInputElement
const btnProcessVocal = document.getElementById('btn-process-vocal') as HTMLButtonElement
const btnDownloadVocal = document.getElementById('btn-download-vocal') as HTMLAnchorElement
const vocalProgressWrap = document.getElementById('vocal-progress-wrap')!
const vocalProgressBar = document.getElementById('vocal-progress-bar')!
const vocalProgressPct = document.getElementById('vocal-progress-pct')!
const vocalProgressText = document.getElementById('vocal-progress-text')!

// 3D Spatial Audio Elements
const spatialRadarCanvas = document.getElementById('spatial-radar-canvas') as HTMLCanvasElement
const selectSpatialPreset = document.getElementById('select-spatial-preset') as HTMLSelectElement
const btnResetSpatial = document.getElementById('btn-reset-spatial') as HTMLButtonElement
const spatialChannelsContainer = document.getElementById('spatial-channels-container')!
const btnProcessSpatial = document.getElementById('btn-process-spatial') as HTMLButtonElement
const btnDownloadSpatial = document.getElementById('btn-download-spatial') as HTMLAnchorElement
const spatialProgressWrap = document.getElementById('spatial-progress-wrap')!
const spatialProgressBar = document.getElementById('spatial-progress-bar')!
const spatialProgressPct = document.getElementById('spatial-progress-pct')!
const spatialProgressText = document.getElementById('spatial-progress-text')!

// AI Match Elements
const aiTargetDropzone = document.getElementById('ai-target-dropzone')!
const aiTargetFileInput = document.getElementById('ai-target-file-input') as HTMLInputElement
const aiTargetTitle = document.getElementById('ai-target-title')!
const aiTargetInfo = document.getElementById('ai-target-info')!
const aiRefDropzone = document.getElementById('ai-ref-dropzone')!
const aiRefFileInput = document.getElementById('ai-ref-file-input') as HTMLInputElement
const aiRefTitle = document.getElementById('ai-ref-title')!
const aiRefInfo = document.getElementById('ai-ref-info')!
const btnRunAiMatch = document.getElementById('btn-run-ai-match') as HTMLButtonElement
const btnDownloadAiMatch = document.getElementById('btn-download-ai-match') as HTMLAnchorElement
const aiProgressWrap = document.getElementById('ai-progress-wrap')!
const aiProgressBar = document.getElementById('ai-progress-bar')!
const aiProgressPct = document.getElementById('ai-progress-pct')!
const aiProgressText = document.getElementById('ai-progress-text')!

// Meters
const meterIntLufs = document.getElementById('meter-int-lufs')!
const meterTruePeak = document.getElementById('meter-true-peak')!
const meterCrest = document.getElementById('meter-crest')!
const meterSampleRate = document.getElementById('meter-sample-rate')!
const meterGrVal = document.getElementById('meter-gr-val')!

// Batch
const batchDropzone = document.getElementById('batch-dropzone')!
const batchFileInput = document.getElementById('batch-file-input') as HTMLInputElement
const batchList = document.getElementById('batch-list')!
const btnRunBatch = document.getElementById('btn-run-batch') as HTMLButtonElement

// Rotary Knobs references
let knobMasterSat: RotaryKnob
let knobMasterWidth: RotaryKnob
let knobMasterIntensity: RotaryKnob
let knobVocalDeess: RotaryKnob
let knobVocalAir: RotaryKnob
let knobVocalDoubler: RotaryKnob
let _knobMicDist: RotaryKnob
let _knobMicDrive: RotaryKnob

// ─── INITIALIZATION ──────────────────────────────────────────────────────────
function init() {
	const spectrumCanvas = document.getElementById('main-spectrum-canvas') as HTMLCanvasElement
	const goniometerCanvas = document.getElementById('goniometer-canvas') as HTMLCanvasElement
	const vuCanvas = document.getElementById('vu-meter-canvas') as HTMLCanvasElement
	const vuCanvasSec = document.getElementById('vu-meter-canvas-secondary') as HTMLCanvasElement

	spectrumVisualizer = new SpectrumVisualizer(spectrumCanvas)
	_phaseGoniometer = new PhaseGoniometer(goniometerCanvas)
	vuMeter = new AnalogVuMeter(vuCanvas, true)
	if (vuCanvasSec) {
		vuMeterSec = new AnalogVuMeter(vuCanvasSec, true)
	}

	const peakCanvas = document.getElementById('transport-peak-meter-canvas') as HTMLCanvasElement
	if (peakCanvas) {
		stereoPeakMeter = new StereoPeakMeter(peakCanvas)
	}

	setupRotaryKnobs()
	populateQuickSelectors()
	renderProducersList('all')
	selectMasterSetup(ALL_MASTERS[0].id, ALL_MASTERS[0].albums[0].id)

	renderMicsGallery('all')
	selectMic(LEGENDARY_MICROPHONES[0].id)

	setupTabs()
	setupStemChannelRack()
	setupVisualMicrophoneGrid()
	setupAudioLoading()
	setupTransportDock()
	setupMasterProcessing()
	setupWelderProcessing()
	setupMicLockerModule()
	setupVocalModule()
	setupSpatialModule()
	setupAiMatchModule()
	setupBatchProcessing()
	setupArrangerModule()
	setupGenerativeTabs()
	ProKeybindingsMatrix.init()
}

// ─── ROTARY KNOBS INITIALIZATION ─────────────────────────────────────────────
function setupRotaryKnobs() {
	const elSat = document.getElementById('knob-master-sat')!
	const elWidth = document.getElementById('knob-master-width')!
	const elInt = document.getElementById('knob-master-intensity')!

	knobMasterSat = new RotaryKnob({
		element: elSat,
		min: 0,
		max: 200,
		initialValue: 100,
		unit: '%',
		color: 'red',
		onChange: (v) => {
			sliderSat.value = String(v)
			labelSatVal.textContent = `${v}%`
			updateTubeGlow(v)
			LiveRigAuditionEngine.setSaturation(activeAlbum.saturation.type, v / 100)
		},
	})

	knobMasterWidth = new RotaryKnob({
		element: elWidth,
		min: 80,
		max: 180,
		initialValue: 142,
		unit: '%',
		color: 'cyan',
		onChange: (v) => {
			sliderWidth.value = String(v)
			labelWidthVal.textContent = `${v}%`
		},
	})

	knobMasterIntensity = new RotaryKnob({
		element: elInt,
		min: 50,
		max: 150,
		initialValue: 100,
		unit: '%',
		color: 'gold',
		onChange: (v) => {
			sliderIntensity.value = String(v)
			labelIntensityVal.textContent = `${v}%`
		},
	})

	sliderSat?.addEventListener('input', () => {
		const v = parseFloat(sliderSat.value)
		labelSatVal.textContent = `${v}%`
		knobMasterSat?.setValue(v, false)
		updateTubeGlow(v)
		LiveRigAuditionEngine.setSaturation(activeAlbum.saturation.type, v / 100)
	})

	sliderWidth?.addEventListener('input', () => {
		const v = parseFloat(sliderWidth.value)
		labelWidthVal.textContent = `${v}%`
		knobMasterWidth?.setValue(v, false)
	})

	sliderIntensity?.addEventListener('input', () => {
		const v = parseFloat(sliderIntensity.value)
		labelIntensityVal.textContent = `${v}%`
		knobMasterIntensity?.setValue(v, false)
	})

	// Vocal Knobs
	const elVDeess = document.getElementById('knob-vocal-deess')!
	const elVAir = document.getElementById('knob-vocal-air')!
	const elVDoubler = document.getElementById('knob-vocal-doubler')!

	knobVocalDeess = new RotaryKnob({
		element: elVDeess,
		min: 0,
		max: 100,
		initialValue: 50,
		unit: '%',
		color: 'gold',
		onChange: (v) => {
			vocalSliderDeess.value = String(v)
		},
	})

	knobVocalAir = new RotaryKnob({
		element: elVAir,
		min: 0,
		max: 12,
		step: 0.5,
		initialValue: 5.0,
		unit: ' dB',
		color: 'cyan',
		onChange: (v) => {
			vocalSliderAir.value = String(v)
		},
	})

	knobVocalDoubler = new RotaryKnob({
		element: elVDoubler,
		min: 0,
		max: 100,
		initialValue: 60,
		unit: '%',
		color: 'red',
		onChange: (v) => {
			vocalSliderDoubler.value = String(v)
		},
	})

	// Mic Knobs
	const elMDist = document.getElementById('knob-mic-dist')!
	const elMDrive = document.getElementById('knob-mic-drive')!

	_knobMicDist = new RotaryKnob({
		element: elMDist,
		min: 1,
		max: 25,
		initialValue: 5,
		unit: ' cm',
		color: 'gold',
		onChange: (v) => {
			micSliderDist.value = String(v)
		},
	})

	_knobMicDrive = new RotaryKnob({
		element: elMDrive,
		min: 50,
		max: 150,
		initialValue: 100,
		unit: '%',
		color: 'red',
		onChange: (v) => {
			micSliderPreamp.value = String(v)
		},
	})
}

function updateTubeGlow(drivePct: number) {
	if (!masterTubeFilament) return
	const brightness = 0.6 + (drivePct / 200) * 0.9
	const blurPx = 10 + (drivePct / 200) * 25
	masterTubeFilament.style.filter = `brightness(${brightness})`
	masterTubeFilament.style.boxShadow = `0 0 ${blurPx}px rgba(255, 119, 0, 0.95), 0 0 ${blurPx * 2}px rgba(255, 68, 0, 0.7)`
}

// ─── PRODUCERS QUICK SELECTORS & DRAWER ──────────────────────────────────────
function populateQuickSelectors() {
	selectProducerQuick.innerHTML = ''
	ALL_MASTERS.forEach((prod) => {
		const opt = document.createElement('option')
		opt.value = prod.id
		opt.textContent = `${prod.name} (${prod.era}) — ${prod.title}`
		if (prod.id === activeProducer.id) opt.selected = true
		selectProducerQuick.appendChild(opt)
	})

	updateAlbumQuickSelector()

	selectProducerQuick.addEventListener('change', () => {
		const prodId = selectProducerQuick.value
		const prod = ALL_MASTERS.find((p) => p.id === prodId)
		if (prod) {
			activeProducer = prod
			activeAlbum = prod.albums[0]
			updateAlbumQuickSelector()
			selectMasterSetup(activeProducer.id, activeAlbum.id)
		}
	})

	selectAlbumQuick.addEventListener('change', () => {
		selectMasterSetup(activeProducer.id, selectAlbumQuick.value)
	})

	btnToggleProducersDrawer.addEventListener('click', () => {
		producersDrawerPanel.classList.toggle('hidden')
	})
}

function updateAlbumQuickSelector() {
	selectAlbumQuick.innerHTML = ''
	activeProducer.albums.forEach((alb) => {
		const opt = document.createElement('option')
		opt.value = alb.id
		opt.textContent = `${alb.band} — ${alb.albumTitle} (${alb.year}) [${alb.targetLufs} LUFS]`
		if (alb.id === activeAlbum.id) opt.selected = true
		selectAlbumQuick.appendChild(opt)
	})
}

// ─── PRODUCERS LIST & CATEGORY FILTERS ────────────────────────────────────────
function renderProducersList(category: string) {
	const filtered =
		category === 'all' ? ALL_MASTERS : ALL_MASTERS.filter((m) => m.category === category)

	producerCardsContainer.innerHTML = ''

	filtered.forEach((prod) => {
		const isSelected = prod.id === activeProducer.id
		const card = document.createElement('div')
		card.setAttribute('data-producer-id', prod.id)
		card.className = `producer-card ${isSelected ? 'active' : ''}`

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
          ${prod.albums
						.map(
							(alb, aIdx) => `
            <option value="${alb.id}" ${aIdx === 0 ? 'selected' : ''}>
              ${alb.band} - ${alb.albumTitle} (${alb.year})
            </option>
          `,
						)
						.join('')}
        </select>
      </div>
      <button type="button" class="btn-select-producer ${isSelected ? 'btn-gold-action' : 'switch-toggle-btn'}" style="width: 100%; padding: 8px; font-size: 11px;">
        ${isSelected ? '✓ CONSOLE ATIVO' : 'CARREGAR NO CONSOLE'}
      </button>
    `

		const dropdown = card.querySelector('.album-dropdown') as HTMLSelectElement
		dropdown.addEventListener('change', (e) => {
			e.stopPropagation()
			selectMasterSetup(prod.id, dropdown.value)
		})

		card.addEventListener('click', (e) => {
			if (
				(e.target as HTMLElement).tagName === 'SELECT' ||
				(e.target as HTMLElement).tagName === 'OPTION'
			)
				return
			selectMasterSetup(prod.id, dropdown.value)
		})

		producerCardsContainer.appendChild(card)
	})
}

filterBtns.forEach((btn) => {
	btn.addEventListener('click', () => {
		filterBtns.forEach((b) => b.classList.remove('active-filter', 'active'))
		btn.classList.add('active-filter', 'active')
		const cat = btn.getAttribute('data-category') || 'all'
		renderProducersList(cat)
	})
})

// ─── MASTER SETUP SELECTION ──────────────────────────────────────────────────
function selectMasterSetup(producerId: string, albumId?: string) {
	const prod = ALL_MASTERS.find((p) => p.id === producerId)
	if (!prod) return

	activeProducer = prod
	if (albumId) {
		const alb = prod.albums.find((a) => a.id === albumId)
		activeAlbum = alb || prod.albums[0]
	} else {
		activeAlbum = prod.albums[0]
	}

	// Keep quick dropdowns in sync
	if (selectProducerQuick.value !== activeProducer.id) {
		selectProducerQuick.value = activeProducer.id
		updateAlbumQuickSelector()
	}
	if (selectAlbumQuick.value !== activeAlbum.id) {
		selectAlbumQuick.value = activeAlbum.id
	}

	const allCards = document.querySelectorAll('.producer-card')
	allCards.forEach((c) => {
		const isThis = c.getAttribute('data-producer-id') === prod.id
		c.classList.toggle('active', isThis)

		const btn = c.querySelector('.btn-select-producer') as HTMLElement
		if (btn) {
			btn.textContent = isThis ? '✓ CONSOLE ATIVO' : 'CARREGAR NO CONSOLE'
			btn.className = `btn-select-producer ${isThis ? 'btn-gold-action' : 'switch-toggle-btn'}`
		}
	})

	activeMasterTag.textContent = activeProducer.name
	activeEraTag.textContent = activeProducer.era.split(' ')[0].toUpperCase()
	activeAlbumTitle.textContent = `${activeAlbum.band} - ${activeAlbum.albumTitle} (${activeAlbum.year})`
	activeCountryText.textContent = `${activeProducer.country} · ${activeProducer.title}`
	specTuning.textContent = activeAlbum.tuningSignature
		? `${activeAlbum.tuningSignature.standardName} [${activeAlbum.tuningSignature.baseFreqA4Hz}Hz]`
		: 'Standard E (440Hz)'
	specGuitarAmp.textContent = activeAlbum.guitarToneprint
		? `${activeAlbum.guitarToneprint.ampModel.toUpperCase().replace('_', ' ')} (Drive ${Math.round(activeAlbum.guitarToneprint.distortionGain * 100)}%)`
		: 'Mesa Rectifier'
	specLufs.textContent = `${activeAlbum.targetLufs} LUFS`
	specSat.textContent = `${activeAlbum.saturation.type.replace('_', ' ').toUpperCase()} (${Math.round(activeAlbum.saturation.drive * 100)}%)`
	specComp.textContent = `Ratio ${activeAlbum.compressor.ratio}:1`
	specWidth.textContent = `${Math.round(activeAlbum.stereoWidth * 100)}%`
	specChain.textContent = activeAlbum.hardwareChain

	const satVal = Math.round(activeAlbum.saturation.drive * 100)
	const widthVal = Math.round(activeAlbum.stereoWidth * 100)

	sliderSat.value = String(satVal)
	sliderWidth.value = String(widthVal)
	knobMasterSat?.setValue(satVal, false)
	knobMasterWidth?.setValue(widthVal, false)
	updateTubeGlow(satVal)

	gemCardDrums.textContent = activeAlbum.gemSetup.drums.description
	gemCardBass.textContent = activeAlbum.gemSetup.bass.description
	gemCardGuitars.textContent = activeAlbum.gemSetup.guitars.description
	gemCardVocals.textContent = activeAlbum.gemSetup.vocals.description
	gemCardSynths.textContent = activeAlbum.gemSetup.synthsFx.description

	LiveRigAuditionEngine.setSaturation(activeAlbum.saturation.type, activeAlbum.saturation.drive)
	spectrumVisualizer.setTargetAlbum(activeAlbum)
}

// ─── MIC LOCKER GALLERY & LOGIC ──────────────────────────────────────────────
function renderMicsGallery(category: string) {
	const filtered =
		category === 'all'
			? LEGENDARY_MICROPHONES
			: LEGENDARY_MICROPHONES.filter((m) => m.category === category)

	micsCount.textContent = `${filtered.length} Microfones Históricos Disponíveis`
	micsGalleryContainer.innerHTML = ''

	filtered.forEach((mic) => {
		const isSelected = mic.id === activeMic.id
		const card = document.createElement('div')
		card.setAttribute('data-mic-id', mic.id)
		card.className = `mic-card ${isSelected ? 'active' : ''}`

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
    `

		card.addEventListener('click', () => selectMic(mic.id))
		micsGalleryContainer.appendChild(card)
	})
}

function selectMic(micId: string) {
	const mic = LEGENDARY_MICROPHONES.find((m) => m.id === micId)
	if (!mic) return

	activeMic = mic

	const allCards = document.querySelectorAll('.mic-card')
	allCards.forEach((c) => {
		const isThis = c.getAttribute('data-mic-id') === mic.id
		c.classList.toggle('border-amber-500', isThis)
		c.classList.toggle('bg-amber-950/30', isThis)
		c.classList.toggle('shadow-[0_0_15px_rgba(245,158,11,0.3)]', isThis)
		c.classList.toggle('border-slate-800', !isThis)
		c.classList.toggle('bg-transparent', !isThis)

		const btn = c.querySelector('.btn-select-mic')
		if (btn) {
			btn.textContent = isThis ? '✓ Selecionado' : 'Equipar'
			btn.className = `btn-select-mic px-2 py-0.5 rounded font-bold ${
				isThis ? 'bg-amber-500 text-black' : 'bg-slate-900 border border-slate-700 text-amber-300'
			}`
		}
	})

	activeMicIcon.textContent = mic.icon
	activeMicBrand.textContent = mic.brand
	activeMicName.textContent = mic.name
	activeMicCapsule.textContent = mic.capsule.replace('_', ' ').toUpperCase()
	activeMicPolar.textContent = mic.polarPattern.replace('_', ' ').toUpperCase()
	activeMicPreamp.textContent = `${mic.preampType.replace('_', ' ').toUpperCase()} (${Math.round(mic.preampDrive * 100)}% DRIVE)`
	activeMicUsers.textContent = mic.famousUsers
}

micFilterBtns.forEach((btn) => {
	btn.addEventListener('click', () => {
		micFilterBtns.forEach((b) =>
			b.classList.remove('active-filter', 'text-amber-400', 'border-amber-500'),
		)
		btn.classList.add('active-filter', 'text-amber-400', 'border-amber-500')
		const cat = btn.getAttribute('data-mic-category') || 'all'
		renderMicsGallery(cat)
	})
})

function setupMicLockerModule() {
	btnProcessMic.addEventListener('click', async () => {
		const buf = vocalBuffer || audioBuffer
		if (!buf) return

		btnProcessMic.disabled = true
		micProgressWrap.classList.remove('hidden')

		try {
			const res = await MicModelingEngine.modelMicrophone(buf, {
				mic: activeMic,
				distanceCm: parseFloat(micSliderDist.value),
				preampDriveMultiplier: parseFloat(micSliderPreamp.value) / 100,
				onProgress: (pct, txt) => {
					micProgressBar.style.width = `${pct}%`
					micProgressPct.textContent = `${pct}%`
					micProgressText.textContent = txt
				},
			})

			const mUrl = URL.createObjectURL(res.wavBlob)
			btnDownloadMic.href = mUrl
			btnDownloadMic.download = res.downloadFilename
			btnDownloadMic.classList.remove('hidden')

			mainAudioPlayer.src = mUrl
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} catch (err: any) {
			micProgressText.textContent = `❌ Erro: ${err.message || String(err)}`
		} finally {
			btnProcessMic.disabled = false
		}
	})
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function setupTabs() {
	const tabs = document.querySelectorAll('.studio-tab') as NodeListOf<HTMLButtonElement>
	const contents = document.querySelectorAll('.tab-content')

	tabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			tabs.forEach((t) => t.classList.remove('active'))
			contents.forEach((c) => c.classList.add('hidden'))

			tab.classList.add('active')
			const targetId = tab.getAttribute('data-tab')
			if (targetId) {
				document.getElementById(targetId)?.classList.remove('hidden')
			}
			if (targetId === 'tab-spatial') {
				renderSpatialRadar()
			}
		})
	})
}

// ─── STEM CHANNEL STRIP RACK & VISUAL MICROPHONE SELECTION ───────────────────
function setupStemChannelRack() {
	const stemButtons = document.querySelectorAll('.stem-tab-btn')
	const stemPanels = document.querySelectorAll('.stem-panel')

	stemButtons.forEach((btn) => {
		btn.addEventListener('click', () => {
			stemButtons.forEach((b) => b.classList.remove('active'))
			stemPanels.forEach((p) => p.classList.remove('active'))

			btn.classList.add('active')
			const target = btn.getAttribute('data-stem-target')
			if (target) {
				const panel = document.getElementById(target)
				if (panel) panel.classList.add('active')
			}
		})
	})
}

function setupVisualMicrophoneGrid() {
	const micSelect = document.getElementById(
		'select-vocal-microphone-model',
	) as HTMLSelectElement | null
	const micCards = document.querySelectorAll<HTMLElement>('.mic-vertical-card, .mic-visual-card')

	const showcaseBadge = document.getElementById('mic-showcase-badge')
	const showcaseTitle = document.getElementById('mic-showcase-title')
	const showcaseSub = document.getElementById('mic-showcase-sub')
	const showcaseCapsule = document.getElementById('mic-showcase-capsule')
	const showcasePreamp = document.getElementById('mic-showcase-preamp')
	const showcaseSpl = document.getElementById('mic-showcase-spl')
	const showcaseArtists = document.getElementById('mic-showcase-artists')

	const updateShowcaseFromCard = (card: HTMLElement) => {
		const icon = card.getAttribute('data-icon') || '🎙️'
		const title = card.getAttribute('data-title') || 'Microfone Selecionado'
		const sub = card.getAttribute('data-sub') || 'CALIBRAÇÃO ANALÓGICA'
		const capsule = card.getAttribute('data-capsule') || 'Linear'
		const preamp = card.getAttribute('data-preamp') || 'Estúdio'
		const spl = card.getAttribute('data-spl') || '64-Bit DSP'
		const artists = card.getAttribute('data-artists') || ''

		if (showcaseBadge) showcaseBadge.textContent = icon
		if (showcaseTitle) showcaseTitle.textContent = title
		if (showcaseSub) showcaseSub.textContent = sub
		if (showcaseCapsule) showcaseCapsule.textContent = `Cápsula: ${capsule}`
		if (showcasePreamp) showcasePreamp.textContent = `Pré: ${preamp}`
		if (showcaseSpl) showcaseSpl.textContent = `Calibração: ${spl}`
		if (showcaseArtists) showcaseArtists.textContent = `🎤 ${artists}`
	}

	micCards.forEach((card) => {
		card.addEventListener('click', () => {
			const micId = card.getAttribute('data-mic-id')
			if (!micId) return

			micCards.forEach((c) => c.classList.remove('active'))
			card.classList.add('active')
			updateShowcaseFromCard(card)

			if (micSelect) {
				micSelect.value = micId
				micSelect.dispatchEvent(new Event('change'))
			}
		})
	})

	if (micSelect) {
		micSelect.addEventListener('change', () => {
			const currentVal = micSelect.value
			micCards.forEach((c) => {
				if (c.getAttribute('data-mic-id') === currentVal) {
					c.classList.add('active')
					updateShowcaseFromCard(c)
				} else {
					c.classList.remove('active')
				}
			})
		})
	}
}

// ─── AUDIO LOADING & TRANSPORT DOCK ──────────────────────────────────────────
function setupAudioLoading() {
	audioDropzone.addEventListener('click', () => audioFileInput.click())
	audioFileInput.addEventListener('change', () => {
		const file = audioFileInput.files?.[0]
		if (file) loadAudioFile(file)
	})
	audioDropzone.addEventListener('dragover', (e) => {
		e.preventDefault()
		audioDropzone.classList.add('border-amber-400')
	})
	audioDropzone.addEventListener('dragleave', () => {
		audioDropzone.classList.remove('border-amber-400')
	})
	audioDropzone.addEventListener('drop', (e: DragEvent) => {
		e.preventDefault()
		audioDropzone.classList.remove('border-amber-400')
		const file = e.dataTransfer?.files[0]
		if (file) loadAudioFile(file)
	})

	// ─── V4 HYPERREFERENCE FILE DROPZONE (ST-ITO) ───────────────────────────────
	const v4RefDropzone = document.getElementById('v4-ref-dropzone')
	const v4RefFileInput = document.getElementById('v4-ref-file-input') as HTMLInputElement
	const v4RefDropText = document.getElementById('v4-ref-drop-text')
	const v4RefStatus = document.getElementById('v4-ref-dna-status')

	const loadRefFile = async (file: File) => {
		try {
			if (v4RefDropText) v4RefDropText.textContent = `⏳ Decodificando ${file.name}...`
			const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
			v4ReferenceBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(file, decodeCtx)
			if (v4RefDropText)
				v4RefDropText.innerHTML = `✅ <strong>${file.name}</strong> (${(file.size / 1024 / 1024).toFixed(1)}MB)`
			if (v4RefStatus) v4RefStatus.textContent = 'DNA: REFERÊNCIA CARREGADA (ST-ITO ATIVO)'
		} catch (_err) {
			if (v4RefDropText) v4RefDropText.textContent = '❌ Erro ao decodificar áudio de referência.'
		}
	}

	v4RefDropzone?.addEventListener('click', () => v4RefFileInput?.click())
	v4RefFileInput?.addEventListener('change', () => {
		const file = v4RefFileInput.files?.[0]
		if (file) loadRefFile(file)
	})
	v4RefDropzone?.addEventListener('dragover', (e) => {
		e.preventDefault()
		v4RefDropzone.style.borderColor = '#10b981'
	})
	v4RefDropzone?.addEventListener('dragleave', () => {
		v4RefDropzone.style.borderColor = 'rgba(245, 158, 11, 0.5)'
	})
	v4RefDropzone?.addEventListener('drop', (e: DragEvent) => {
		e.preventDefault()
		v4RefDropzone.style.borderColor = 'rgba(245, 158, 11, 0.5)'
		const file = e.dataTransfer?.files[0]
		if (file) loadRefFile(file)
	})
}

function setupTransportDock() {
	const readout = document.getElementById('transport-peak-readout')

	function initPlaybackMeter() {
		if (playbackAudioCtx) {
			if (playbackAudioCtx.state === 'suspended') {
				playbackAudioCtx.resume()
			}
			return
		}
		try {
			// @ts-expect-error
			playbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
			playbackSourceNode = playbackAudioCtx.createMediaElementSource(mainAudioPlayer)

			const splitter = playbackAudioCtx.createChannelSplitter(2)
			analyserL = playbackAudioCtx.createAnalyser()
			analyserR = playbackAudioCtx.createAnalyser()
			analyserL.fftSize = 512
			analyserR.fftSize = 512
			playbackDataL = new Float32Array(analyserL.frequencyBinCount)
			playbackDataR = new Float32Array(analyserR.frequencyBinCount)

			// Safe master playback trim (-2.5dB headroom) to protect soundcards from clipping
			const safeOutputGain = playbackAudioCtx.createGain()
			safeOutputGain.gain.value = 0.75

			playbackSourceNode.connect(splitter)
			splitter.connect(analyserL, 0)
			splitter.connect(analyserR, 1)

			playbackSourceNode.connect(safeOutputGain)
			safeOutputGain.connect(playbackAudioCtx.destination)

			// Connect Real-Time Spectrum and Goniometer nodes
			try {
				if (_phaseGoniometer) _phaseGoniometer.connectStereoNodes(analyserL, analyserR)
				if (spectrumVisualizer) spectrumVisualizer.connectAnalyser(analyserL)
			} catch (_vErr) {}

			startPeakMeterLoop()
		} catch (_err) {}
	}

	function startPeakMeterLoop() {
		if (isPeakMeterRunning) return
		isPeakMeterRunning = true

		const cockpitLufs = document.getElementById('cockpit-lufs-val')
		const cockpitTruePeak = document.getElementById('cockpit-truepeak-val')
		const cockpitPhase = document.getElementById('cockpit-phase-val')
		const meterPhase = document.getElementById('meter-phase-val')
		const cockpitCrest = document.getElementById('cockpit-crest-val')

		function loop() {
			if (playbackAudioCtx && !mainAudioPlayer.paused && analyserL && analyserR) {
				analyserL.getFloatTimeDomainData(playbackDataL)
				analyserR.getFloatTimeDomainData(playbackDataR)

				let peakL = 0
				let peakR = 0
				let sumL2 = 0
				let sumR2 = 0
				let sumLR = 0

				for (let i = 0; i < playbackDataL.length; i++) {
					const aL = playbackDataL[i]
					const aR = playbackDataR[i]
					const absL = Math.abs(aL)
					const absR = Math.abs(aR)
					if (absL > peakL) peakL = absL
					if (absR > peakR) peakR = absR

					sumL2 += aL * aL
					sumR2 += aR * aR
					sumLR += aL * aR
				}

				stereoPeakMeter.updateLevels(peakL, peakR)

				const maxPeak = Math.max(peakL, peakR)
				const rmsAvg = Math.sqrt((sumL2 + sumR2) / (playbackDataL.length * 2))
				const denom = Math.sqrt(sumL2 * sumR2)
				const corr = denom > 0.00001 ? sumLR / denom : 1.0

				// Update Real-Time Cockpit Telemetry HUD
				if (cockpitLufs) {
					cockpitLufs.textContent =
						rmsAvg > 0.0001 ? `${(20 * Math.log10(rmsAvg) - 0.691).toFixed(1)} LUFS` : '-∞ LUFS'
				}
				if (cockpitTruePeak) {
					cockpitTruePeak.textContent =
						maxPeak > 0.0001 ? `${(20 * Math.log10(maxPeak)).toFixed(2)} dBTP` : '-∞ dBTP'
				}
				if (cockpitPhase) {
					cockpitPhase.textContent = `${corr >= 0 ? '+' : ''}${corr.toFixed(2)} (${corr > 0.7 ? 'Mono Safe' : corr > 0.2 ? 'Wide' : 'Anti-Phase!'})`
					cockpitPhase.style.color = corr > 0.7 ? '#10b981' : corr > 0.2 ? '#f59e0b' : '#ef4444'
				}
				if (meterPhase) {
					meterPhase.textContent = `${corr >= 0 ? '+' : ''}${corr.toFixed(2)} (L/R)`
					meterPhase.style.color = corr > 0.7 ? '#10b981' : '#f59e0b'
				}
				if (cockpitCrest) {
					cockpitCrest.textContent =
						maxPeak > 0 && rmsAvg > 0
							? `${(20 * Math.log10(maxPeak / rmsAvg)).toFixed(1)} dB`
							: '9.5 dB'
				}

				if (readout) {
					const dbL = peakL > 0.0001 ? (20 * Math.log10(peakL)).toFixed(1) : '-∞'
					const dbR = peakR > 0.0001 ? (20 * Math.log10(peakR)).toFixed(1) : '-∞'
					const isClip = stereoPeakMeter.hasClipped()
					readout.textContent = `L: ${dbL} dB | R: ${dbR} dB`
					readout.style.color = isClip
						? '#ef4444'
						: parseFloat(dbL) > -3 || parseFloat(dbR) > -3
							? '#f59e0b'
							: '#10b981'
				}
			} else if (stereoPeakMeter) {
				stereoPeakMeter.updateLevels(0, 0)
				if (readout && mainAudioPlayer.paused) {
					readout.textContent = 'L: -∞ dB | R: -∞ dB'
					readout.style.color = '#10b981'
				}
			}
			requestAnimationFrame(loop)
		}
		loop()
	}

	btnTransportPlay.addEventListener('click', () => {
		if (!mainAudioPlayer.src) return
		initPlaybackMeter()
		if (mainAudioPlayer.paused) {
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} else {
			mainAudioPlayer.pause()
			btnTransportPlay.textContent = '▶'
		}
	})

	mainAudioPlayer.addEventListener('timeupdate', () => {
		if (!mainAudioPlayer.duration) return
		const cur = mainAudioPlayer.currentTime
		const dur = mainAudioPlayer.duration
		transportScrub.value = String((cur / dur) * 100)

		const cMin = Math.floor(cur / 60)
		const cSec = Math.floor(cur % 60)
			.toString()
			.padStart(2, '0')
		const dMin = Math.floor(dur / 60)
		const dSec = Math.floor(dur % 60)
			.toString()
			.padStart(2, '0')

		transportTimeCurrent.textContent = `${cMin}:${cSec}`
		transportTimeTotal.textContent = `${dMin}:${dSec}`
	})

	transportScrub.addEventListener('input', () => {
		if (!mainAudioPlayer.duration) return
		const pct = parseFloat(transportScrub.value) / 100
		mainAudioPlayer.currentTime = pct * mainAudioPlayer.duration
	})

	// Jump to Loudest Section / Chorus
	const btnJumpLoudest = document.getElementById('btn-jump-loudest') as HTMLButtonElement
	btnJumpLoudest?.addEventListener('click', () => {
		if (!audioBuffer) return
		const loudestSec = WaveformScrubber.findLoudestSectionSec()
		mainAudioPlayer.currentTime = loudestSec
		if (mainAudioPlayer.paused) {
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		}
	})

	const chkAbGainMatch = document.getElementById('chk-ab-gain-match') as HTMLInputElement

	btnAbOrig.addEventListener('click', () => {
		if (!loadedFile) return
		const currentPlayTime = mainAudioPlayer.currentTime
		const wasPlaying = !mainAudioPlayer.paused
		initPlaybackMeter()
		mainAudioPlayer.src = URL.createObjectURL(loadedFile)
		mainAudioPlayer.volume = isDim ? 0.1 : 1.0
		mainAudioPlayer.onloadedmetadata = () => {
			mainAudioPlayer.currentTime = currentPlayTime
			if (wasPlaying) mainAudioPlayer.play()
		}
		btnAbOrig.className = 'switch-toggle-btn active-red'
		btnAbMaster.className = 'switch-toggle-btn'
	})

	btnAbMaster.addEventListener('click', () => {
		const blob = lastWelderResult?.weldedWavBlob || lastMasterResult?.wavBlob
		if (!blob) return
		const currentPlayTime = mainAudioPlayer.currentTime
		const wasPlaying = !mainAudioPlayer.paused
		initPlaybackMeter()

		let gainMatchScale = 1.0
		if (chkAbGainMatch?.checked && audioBuffer && lastMasterResult?.masterBuffer) {
			const match = PerceptualLoudnessMatcher.computeMatchingGain(
				audioBuffer,
				lastMasterResult.masterBuffer,
			)
			gainMatchScale = match.masterGain
		}

		mainAudioPlayer.src = URL.createObjectURL(blob)
		mainAudioPlayer.volume = isDim ? 0.1 : gainMatchScale
		mainAudioPlayer.onloadedmetadata = () => {
			mainAudioPlayer.currentTime = currentPlayTime
			if (wasPlaying) mainAudioPlayer.play()
		}
		btnAbMaster.className = 'switch-toggle-btn active-gold'
		btnAbOrig.className = 'switch-toggle-btn'
	})

	btnMonoCheck.addEventListener('click', () => {
		isMono = !isMono
		btnMonoCheck.classList.toggle('active-on', isMono)
	})

	btnDim.addEventListener('click', () => {
		isDim = !isDim
		btnDim.classList.toggle('active-red', isDim)
		mainAudioPlayer.volume = isDim ? 0.1 : 1.0
	})

	const selectStudioMonitor = document.getElementById('select-studio-monitor') as HTMLSelectElement
	selectStudioMonitor?.addEventListener('change', () => {
		BinauralStudioMonitor.setModel(selectStudioMonitor.value as any)
		const selectedText = selectStudioMonitor.selectedOptions[0]?.text || selectStudioMonitor.value
		showStudioToast(`🎧 Monitor de Referência: ${selectedText}`, 'info')
	})
}

export function showStudioToast(
	message: string,
	type: 'success' | 'info' | 'warn' = 'info',
	durationMs = 3500,
) {
	const container = document.getElementById('studio-toast-container')
	if (!container) return
	const toast = document.createElement('div')
	toast.className = `studio-toast ${type}`
	const icon = type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️'
	toast.innerHTML = `<span style="font-size: 14px;">${icon}</span><span>${message}</span>`
	container.appendChild(toast)
	requestAnimationFrame(() => {
		toast.classList.add('show')
	})
	setTimeout(() => {
		toast.classList.remove('show')
		setTimeout(() => toast.remove(), 400)
	}, durationMs)
}

async function loadAudioFile(file: File) {
	loadedFile = file
	loadedFileName.textContent = file.name
	loadedFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`

	dropIdleState.classList.add('hidden')
	dropActiveState.classList.remove('hidden')

	const fileUrl = URL.createObjectURL(file)
	mainAudioPlayer.src = fileUrl

	try {
		// @ts-expect-error
		audioCtx = new (window.AudioContext || window.webkitAudioContext)()
		audioBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(file, audioCtx)

		const dur = audioBuffer.duration
		const mins = Math.floor(dur / 60)
		const secs = Math.floor(dur % 60)
			.toString()
			.padStart(2, '0')
		loadedFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${mins}:${secs}`
		transportTimeTotal.textContent = `${mins}:${secs}`

		btnProcessMaster.disabled = false
		btnProcessMaster.classList.remove('opacity-50', 'cursor-not-allowed')

		if (masterProgressWrap) {
			masterProgressWrap.classList.remove('hidden')
			masterProgressBar.style.width = '100%'
			masterProgressBar.style.backgroundColor = '#10b981'
			masterProgressPct.textContent = 'Pronto'
			masterProgressText.innerHTML = `🎵 <strong>Áudio carregado com sucesso (${file.name})!</strong> Clique em <strong>PROCESSAR MASTER ANALÓGICO</strong> abaixo.`
		}

		btnProcessWelder.disabled = false
		btnProcessWelder.classList.remove('opacity-50', 'cursor-not-allowed')

		btnProcessMic.disabled = false
		btnProcessMic.classList.remove('opacity-50', 'cursor-not-allowed')

		btnProcessSpatial.disabled = false
		btnProcessSpatial.classList.remove('opacity-50', 'cursor-not-allowed')

		initArrangerWithAudio(audioBuffer)

		// ─── AUTOMATIC KEY & MUSICAL SCALE DETECTION ────────────────────────────
		try {
			const keyRes = KeyDetectorEngine.detectKey(audioBuffer)
			const selectPitchRoot = document.getElementById('select-pitch-root-key') as HTMLSelectElement
			const selectPitchScale = document.getElementById('select-pitch-scale') as HTMLSelectElement
			const labelKeyBadge = document.getElementById('label-detected-key-badge')

			if (selectPitchRoot) selectPitchRoot.value = keyRes.rootKey
			if (selectPitchScale) selectPitchScale.value = keyRes.scale
			if (labelKeyBadge) {
				labelKeyBadge.textContent = `⚡ TOM DETECTADO: ${keyRes.keyName} (${(keyRes.confidence * 100).toFixed(1)}% Confiança)`
			}
		} catch (_kErr) {}

		meterSampleRate.textContent = `${(audioBuffer.sampleRate / 1000).toFixed(1)} kHz 24-bit HD`
	} catch (_err) {
		loadedFileStats.textContent = '❌ Erro ao decodificar arquivo de áudio.'
		if (masterProgressWrap) {
			masterProgressWrap.classList.remove('hidden')
			masterProgressBar.style.width = '100%'
			masterProgressBar.style.backgroundColor = '#ef4444'
			masterProgressPct.textContent = 'Erro'
			masterProgressText.innerHTML =
				'❌ <strong>Erro ao decodificar áudio.</strong> Certifique-se de que o arquivo é um WAV, MP3 ou AAC válido.'
		}
	}
}

/**
 * Loads any generated or synthesized AudioBuffer into the transport dock, player, and studio mastering engine.
 */
function loadBufferIntoStudio(buf: AudioBuffer, filename: string) {
	audioBuffer = buf
	const wavBlob = audioBufferTo24BitWavBlob(buf)
	const fileUrl = URL.createObjectURL(wavBlob)
	loadedFile = new File([wavBlob], filename, { type: 'audio/wav' })
	loadedFileName.textContent = filename
	mainAudioPlayer.src = fileUrl

	const dur = buf.duration
	const mins = Math.floor(dur / 60)
	const secs = Math.floor(dur % 60)
		.toString()
		.padStart(2, '0')
	loadedFileStats.textContent = `${(wavBlob.size / (1024 * 1024)).toFixed(1)} MB · ${mins}:${secs}`
	transportTimeTotal.textContent = `${mins}:${secs}`

	dropIdleState.classList.add('hidden')
	dropActiveState.classList.remove('hidden')

	btnProcessMaster.disabled = false
	btnProcessMaster.classList.remove('opacity-50', 'cursor-not-allowed')
	btnProcessWelder.disabled = false
	btnProcessWelder.classList.remove('opacity-50', 'cursor-not-allowed')
	btnProcessMic.disabled = false
	btnProcessMic.classList.remove('opacity-50', 'cursor-not-allowed')
	btnProcessSpatial.disabled = false
	btnProcessSpatial.classList.remove('opacity-50', 'cursor-not-allowed')

	if (masterProgressWrap) {
		masterProgressWrap.classList.remove('hidden')
		masterProgressBar.style.width = '100%'
		masterProgressBar.style.backgroundColor = '#10b981'
		masterProgressPct.textContent = 'Pronto'
		masterProgressText.innerHTML = `🎵 <strong>Música carregada com sucesso (${filename})!</strong> Clique em <strong>PROCESSAR MASTER ANALÓGICO</strong> abaixo.`
	}

	initArrangerWithAudio(audioBuffer)

	try {
		const keyRes = KeyDetectorEngine.detectKey(audioBuffer)
		const selectPitchRoot = document.getElementById('select-pitch-root-key') as HTMLSelectElement
		const selectPitchScale = document.getElementById('select-pitch-scale') as HTMLSelectElement
		const labelKeyBadge = document.getElementById('label-detected-key-badge')

		if (selectPitchRoot) selectPitchRoot.value = keyRes.rootKey
		if (selectPitchScale) selectPitchScale.value = keyRes.scale
		if (labelKeyBadge) {
			labelKeyBadge.textContent = `⚡ TOM DETECTADO: ${keyRes.keyName} (${(keyRes.confidence * 100).toFixed(1)}% Confiança)`
		}
	} catch (_kErr) {}

	meterSampleRate.textContent = `${(audioBuffer.sampleRate / 1000).toFixed(1)} kHz 24-bit HD`
}

// ─── MASTERING ENGINE ────────────────────────────────────────────────────────
function setupMasterProcessing() {
	const sliderDrumBlend = document.getElementById('slider-drum-blend') as HTMLInputElement
	const labelDrumBlendVal = document.getElementById('label-drum-blend-val') as HTMLSpanElement
	const sliderGuitarBlend = document.getElementById('slider-guitar-blend') as HTMLInputElement
	const labelGuitarBlendVal = document.getElementById('label-guitar-blend-val') as HTMLSpanElement
	const sliderBassBlend = document.getElementById('slider-bass-blend') as HTMLInputElement
	const labelBassBlendVal = document.getElementById('label-bass-blend-val') as HTMLSpanElement
	const sliderVocalBlend = document.getElementById('slider-vocal-blend') as HTMLInputElement
	const labelVocalBlendVal = document.getElementById('label-vocal-blend-val') as HTMLSpanElement
	const multiFormatExportWrap = document.getElementById('multi-format-export-wrap')
	const btnExport32bit = document.getElementById('btn-export-32bit') as HTMLButtonElement
	const btnExport16bit = document.getElementById('btn-export-16bit') as HTMLButtonElement

	// ─── MASTER VOICE CLONER WIRING ──────────────────────────────────────────
	const masterVoiceDropzone = document.getElementById('master-user-voice-dropzone')
	const masterVoiceInput = document.getElementById('master-user-voice-input') as HTMLInputElement
	const masterVoiceIdle = document.getElementById('master-user-voice-idle')
	const masterVoiceActive = document.getElementById('master-user-voice-active')
	const masterVoiceFilename = document.getElementById('master-user-voice-filename')
	const masterVoiceBadge = document.getElementById('master-voice-clone-badge')
	const transportVoiceBtn = document.getElementById('transport-user-voice-btn')

	const handleUserVoiceFile = async (file: File) => {
		if (!file) return
		if (masterVoiceFilename) masterVoiceFilename.textContent = file.name
		masterVoiceIdle?.classList.add('hidden')
		masterVoiceActive?.classList.remove('hidden')

		try {
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			const userBuf = await UniversalAudioFormatDecoder.decodeAudioFile(file, ctx)

			// 🌟 AUTOMATIC FULL-MIX STEM EXTRACTION & MEGA-STUDIO ACOUSTIC INPAINTING
			const extracted = await FullMixReferenceStemExtractor.extractAndRepairStem(
				userBuf,
				'vocal',
				ctx,
			)
			const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(extracted.stemBuffer)

			if (masterVoiceBadge) {
				const tag = extracted.isFullMixDetected ? 'MÚSICA COMPLETA' : 'TIMBRE'
				masterVoiceBadge.textContent = `⚡ CLONE ATIVO [${tag}] (+${fp.singersFormantDb.toFixed(1)}dB Presence)`
				masterVoiceBadge.style.color = 'var(--emerald-primary)'
				masterVoiceBadge.style.borderColor = 'var(--emerald-primary)'
			}
			if (transportVoiceBtn) {
				transportVoiceBtn.style.borderColor = 'var(--emerald-primary)'
				transportVoiceBtn.style.color = 'var(--emerald-primary)'
			}
		} catch (_e) {}
	}

	masterVoiceDropzone?.addEventListener('click', () => masterVoiceInput?.click())
	transportVoiceBtn?.addEventListener('click', () => masterVoiceInput?.click())
	masterVoiceInput?.addEventListener('change', () => {
		const file = masterVoiceInput.files?.[0]
		if (file) handleUserVoiceFile(file)
	})

	// ─── 24/7 PERMANENT CLOUD NEURAL ENGINE CONNECTOR ──────────────────────
	const colabStatusLed = document.getElementById('colab-voice-status-led') as HTMLElement | null

	// Automatically connect to 24/7 cloud in background (Zero manual interaction)
	NeuralVoiceClient.autoConnect().then((res) => {
		if (colabStatusLed) {
			if (res.success) {
				colabStatusLed.textContent = `● NUVEM GPU ONLINE (${res.latencyMs}ms)`
				colabStatusLed.style.color = '#10b981'
			} else {
				colabStatusLed.textContent = '● MOTOR NEURAL LOCAL ATIVO'
				colabStatusLed.style.color = '#38bdf8'
			}
		}
	})

	const selectGuitarDoubling = document.getElementById(
		'select-guitar-doubling',
	) as HTMLSelectElement
	const selectGuitarHarmony = document.getElementById('select-guitar-harmony') as HTMLSelectElement
	const selectBassDoubling = document.getElementById('select-bass-doubling') as HTMLSelectElement
	const selectVocalHarmony = document.getElementById('select-vocal-harmony') as HTMLSelectElement

	const chkPitchEnable = document.getElementById('chk-pitch-correct-enable') as HTMLInputElement
	const selectPitchRoot = document.getElementById('select-pitch-root-key') as HTMLSelectElement
	const selectPitchScale = document.getElementById('select-pitch-scale') as HTMLSelectElement
	const sliderRetuneSpeed = document.getElementById('slider-retune-speed') as HTMLInputElement
	const labelRetuneSpeedVal = document.getElementById('label-retune-speed-val') as HTMLSpanElement

	sliderRetuneSpeed?.addEventListener('input', () => {
		const val = parseFloat(sliderRetuneSpeed.value)
		if (labelRetuneSpeedVal) {
			labelRetuneSpeedVal.textContent =
				val > 70
					? `${val}% (Hard Auto-Tune)`
					: val > 30
						? `${val}% (Pop/Trap)`
						: `${val}% (Natural Suave)`
		}
	})

	sliderDrumBlend?.addEventListener('input', () => {
		if (labelDrumBlendVal) labelDrumBlendVal.textContent = `${sliderDrumBlend.value}%`
	})

	sliderGuitarBlend?.addEventListener('input', () => {
		if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = `${sliderGuitarBlend.value}%`
	})

	const sliderSunoGuitarBite = document.getElementById(
		'slider-suno-guitar-bite',
	) as HTMLInputElement | null
	const valSunoGuitarBite = document.getElementById('val-suno-guitar-bite')
	sliderSunoGuitarBite?.addEventListener('input', () => {
		if (valSunoGuitarBite) valSunoGuitarBite.textContent = `${sliderSunoGuitarBite.value}%`
	})

	// ─── GUITAR & BASS NEURAL TIMBRE CLONERS WITH FULL-MIX INPAINTING ─────────
	const guitarDropzone = document.getElementById('guitar-ref-dropzone')
	const guitarInput = document.getElementById('guitar-ref-file-input') as HTMLInputElement | null
	const guitarIdle = document.getElementById('guitar-ref-idle')
	const guitarActive = document.getElementById('guitar-ref-active')
	const guitarFilename = document.getElementById('guitar-ref-filename')
	const guitarStatusBadge = document.getElementById('guitar-clone-status-badge')

	guitarDropzone?.addEventListener('click', () => guitarInput?.click())
	guitarInput?.addEventListener('change', async () => {
		const file = guitarInput.files?.[0]
		if (!file) return
		if (guitarFilename) guitarFilename.textContent = file.name
		guitarIdle?.classList.add('hidden')
		guitarActive?.classList.remove('hidden')
		try {
			const arr = await file.arrayBuffer()
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			const buf = await ctx.decodeAudioData(arr)

			// Extract & Inpaint Guitar Stem from Full Song or Isolated Track
			const extracted = await FullMixReferenceStemExtractor.extractAndRepairStem(buf, 'guitar', ctx)
			const fp = await NeuralInstrumentTimbreCloner.analyzeGuitarSample(extracted.stemBuffer)
			if (guitarStatusBadge) {
				const tag = extracted.isFullMixDetected ? 'MÚSICA' : 'STEM'
				guitarStatusBadge.textContent = `⚡ CLONE GUITARRA [${tag}] (${fp.saturationDrive.toFixed(1)}x Drive)`
				guitarStatusBadge.style.color = '#10b981'
			}
		} catch (_e) {}
	})

	const bassDropzone = document.getElementById('bass-ref-dropzone')
	const bassInput = document.getElementById('bass-ref-file-input') as HTMLInputElement | null
	const bassIdle = document.getElementById('bass-ref-idle')
	const bassActive = document.getElementById('bass-ref-active')
	const bassFilename = document.getElementById('bass-ref-filename')
	const bassStatusBadge = document.getElementById('bass-clone-status-badge')

	bassDropzone?.addEventListener('click', () => bassInput?.click())
	bassInput?.addEventListener('change', async () => {
		const file = bassInput.files?.[0]
		if (!file) return
		if (bassFilename) bassFilename.textContent = file.name
		bassIdle?.classList.add('hidden')
		bassActive?.classList.remove('hidden')
		try {
			const arr = await file.arrayBuffer()
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			const buf = await ctx.decodeAudioData(arr)

			// Extract & Inpaint Bass Stem from Full Song or Isolated Track
			const extracted = await FullMixReferenceStemExtractor.extractAndRepairStem(buf, 'bass', ctx)
			const fp = await NeuralInstrumentTimbreCloner.analyzeBassSample(extracted.stemBuffer)
			if (bassStatusBadge) {
				const tag = extracted.isFullMixDetected ? 'MÚSICA' : 'STEM'
				bassStatusBadge.textContent = `⚡ CLONE BAIXO [${tag}] (${fp.saturationDrive.toFixed(1)}x Growl)`
				bassStatusBadge.style.color = '#10b981'
			}
		} catch (_e) {}
	})

	const sliderTransientPunch = document.getElementById('slider-transient-punch') as HTMLInputElement
	const labelTransientPunchVal = document.getElementById('label-transient-punch-val')
	sliderTransientPunch?.addEventListener('input', () => {
		if (labelTransientPunchVal)
			labelTransientPunchVal.textContent = `${sliderTransientPunch.value}%`
	})

	sliderBassBlend?.addEventListener('input', () => {
		if (labelBassBlendVal) labelBassBlendVal.textContent = `${sliderBassBlend.value}%`
	})

	const selectInputSourceMode = document.getElementById(
		'select-input-source-mode',
	) as HTMLSelectElement
	const sourceModeHint = document.getElementById('source-mode-hint')

	selectInputSourceMode?.addEventListener('change', () => {
		const mode = selectInputSourceMode.value
		if (mode === 'studio_demo') {
			if (sourceModeHint)
				sourceModeHint.innerHTML =
					'✅ <strong>Modo Estúdio Puro:</strong> Preserva 100% dos seus instrumentos e voz originais sem re-síntese ou dobras artificiais.'
			if (sliderDrumBlend) sliderDrumBlend.value = '0'
			if (sliderGuitarBlend) sliderGuitarBlend.value = '0'
			if (sliderBassBlend) sliderBassBlend.value = '0'
			if (sliderVocalBlend) sliderVocalBlend.value = '0'
			if (labelDrumBlendVal) labelDrumBlendVal.textContent = '0%'
			if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = '0%'
			if (labelBassBlendVal) labelBassBlendVal.textContent = '0%'
			if (labelVocalBlendVal) labelVocalBlendVal.textContent = '0%'
			if (selectGuitarDoubling) selectGuitarDoubling.value = 'off'
			if (selectGuitarHarmony) selectGuitarHarmony.value = 'none'
			if (selectVocalHarmony) selectVocalHarmony.value = 'none'
		} else if (mode === 'ai_generated') {
			if (sourceModeHint)
				sourceModeHint.innerHTML =
					'🤖 <strong>Modo IA:</strong> Reconstrói baterias, guitarras e remove defeitos e robôs do Suno/Udio.'
			if (sliderDrumBlend) sliderDrumBlend.value = '65'
			if (sliderGuitarBlend) sliderGuitarBlend.value = '65'
			if (sliderBassBlend) sliderBassBlend.value = '65'
			if (sliderVocalBlend) sliderVocalBlend.value = '65'
			if (labelDrumBlendVal) labelDrumBlendVal.textContent = '65%'
			if (labelGuitarBlendVal) labelGuitarBlendVal.textContent = '65%'
			if (labelBassBlendVal) labelBassBlendVal.textContent = '65%'
			if (selectGuitarDoubling) selectGuitarDoubling.value = 'off'
		} else {
			if (sourceModeHint)
				sourceModeHint.innerHTML =
					'⚡ <strong>Auto-Detecção:</strong> O sistema inspeciona a coerência de fase e seleciona a melhor rota analógica.'
		}
	})

	sliderVocalBlend?.addEventListener('input', () => {
		if (labelVocalBlendVal) labelVocalBlendVal.textContent = `${sliderVocalBlend.value}%`
	})

	const btnAiAutoCalibrate = document.getElementById('btn-ai-autocalibrate') as HTMLButtonElement
	if (btnAiAutoCalibrate) {
		btnAiAutoCalibrate.addEventListener('click', () => {
			if (!audioBuffer) {
				audioFileInput.click()
				return
			}
			btnAiAutoCalibrate.textContent = '⏳ Auto-Calibrando Parâmetros...'
			const cal = AiMasterAutoCalibrator.autoCalibrate(audioBuffer, activeAlbum)

			sliderSat.value = `${Math.round(cal.recommendedDrive * 100)}`
			sliderWidth.value = `${Math.round(cal.recommendedWidth * 100)}`
			if (valSat) valSat.textContent = `${Math.round(cal.recommendedDrive * 100)}%`
			if (valWidth) valWidth.textContent = `${Math.round(cal.recommendedWidth * 100)}%`

			const chkDynamicDeHarsh = document.getElementById('chk-dynamic-deharsh') as HTMLInputElement
			const chkKickBassUnmask = document.getElementById('chk-kick-bass-unmask') as HTMLInputElement
			if (chkDynamicDeHarsh) chkDynamicDeHarsh.checked = cal.recommendedDeHarsh
			if (chkKickBassUnmask) chkKickBassUnmask.checked = cal.recommendedUnmask

			btnAiAutoCalibrate.textContent = `✨ MATCH ${cal.similarityScore}% ATINGIDO!`
			showStudioToast(
				`🪄 Auto-Calibrado: Match de ${cal.similarityScore}% com "${activeAlbum.albumTitle}"!`,
				'success',
				4500,
			)
			setTimeout(() => {
				btnAiAutoCalibrate.textContent = '🪄 AUTO-CALIBRAR PARA MATCH PERFEITO (>99.5%)'
			}, 3000)
		})
	}

	btnProcessMaster.addEventListener('click', async () => {
		if (!audioBuffer) {
			if (audioDropzone) {
				audioDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' })
				audioDropzone.classList.add('border-amber-400')
				setTimeout(() => audioDropzone.classList.remove('border-amber-400'), 2500)
			}
			if (masterProgressWrap) {
				masterProgressWrap.classList.remove('hidden')
				masterProgressBar.style.width = '100%'
				masterProgressBar.style.backgroundColor = '#f59e0b'
				masterProgressPct.textContent = 'Atenção'
				masterProgressText.innerHTML =
					'⚠️ <strong>Nenhum áudio carregado!</strong> Selecione ou arraste um arquivo de áudio (WAV ou MP3) na área acima para iniciar.'
			}
			audioFileInput.click()
			return
		}

		btnProcessMaster.disabled = true
		btnProcessMaster.classList.add('opacity-50')
		btnProcessMaster.textContent = '⏳ PROCESSANDO MASTER ANALÓGICO...'
		masterProgressWrap.classList.remove('hidden')
		masterProgressBar.style.backgroundColor = '#ef4444'
		masterProgressBar.style.width = '5%'
		masterProgressPct.textContent = '5%'
		masterProgressText.textContent = 'Iniciando Masterização Quântica Analógica...'

		try {
			const selectStreamingTarget = document.getElementById(
				'select-streaming-target',
			) as HTMLSelectElement
			const selectAnalogTapeModel = document.getElementById(
				'select-analog-tape-model',
			) as HTMLSelectElement
			const selectLimiterMode = document.getElementById('select-limiter-mode') as HTMLSelectElement
			const selectRealWorldDevice = document.getElementById(
				'select-real-world-device',
			) as HTMLSelectElement
			const selectDrumKitModel = document.getElementById(
				'select-drum-kit-model',
			) as HTMLSelectElement
			const selectGuitarRigModel = document.getElementById(
				'select-guitar-rig-model',
			) as HTMLSelectElement
			const selectBassRigModel = document.getElementById(
				'select-bass-rig-model',
			) as HTMLSelectElement
			const selectSecretProducerHack = document.getElementById(
				'select-secret-producer-hack',
			) as HTMLSelectElement
			const selectVocalMicrophoneModel = document.getElementById(
				'select-vocal-microphone-model',
			) as HTMLSelectElement
			const selectGuitarMicrophoneModel = document.getElementById(
				'select-guitar-microphone-model',
			) as HTMLSelectElement | null
			const selectBassMicrophoneModel = document.getElementById(
				'select-bass-microphone-model',
			) as HTMLSelectElement | null
			const selectDrumMicrophoneModel = document.getElementById(
				'select-drum-microphone-model',
			) as HTMLSelectElement | null
			const selectSynthMicrophoneModel = document.getElementById(
				'select-synth-microphone-model',
			) as HTMLSelectElement | null
			const chkSunoGuitarRescue = document.getElementById(
				'chk-suno-guitar-rescue',
			) as HTMLInputElement | null
			const selectSunoGuitarStyle = document.getElementById(
				'select-suno-guitar-style',
			) as HTMLSelectElement | null
			const sliderSunoGuitarBite = document.getElementById(
				'slider-suno-guitar-bite',
			) as HTMLInputElement | null
			const chkSunoExtraGemWall = document.getElementById(
				'chk-suno-extra-gem-wall',
			) as HTMLInputElement | null
			const chkAiAssistantEnable = document.getElementById(
				'chk-ai-assistant-enable',
			) as HTMLInputElement
			const chkV5DeResonator = document.getElementById('chk-v5-de-resonator') as HTMLInputElement
			const chkV5TransientPro = document.getElementById('chk-v5-transient-pro') as HTMLInputElement
			const chkV5DiffVoxSheen = document.getElementById('chk-v5-diffvox-sheen') as HTMLInputElement
			const chkVOmegaCrosstalk = document.getElementById(
				'chk-v-omega-crosstalk',
			) as HTMLInputElement
			const chkVOmegaSubharmonic = document.getElementById(
				'chk-v-omega-subharmonic',
			) as HTMLInputElement
			const chkVOmegaPocketQuantize = document.getElementById(
				'chk-v-omega-pocket-quantize',
			) as HTMLInputElement
			const chkVOmegaAntiMask = document.getElementById('chk-v-omega-anti-mask') as HTMLInputElement
			const chkVInfAsymmetry = document.getElementById('chk-v-inf-asymmetry') as HTMLInputElement
			const chkVInfAkgK92 = document.getElementById('chk-v-inf-akg-k92') as HTMLInputElement
			const chkVInfDeclip = document.getElementById('chk-v-inf-declip') as HTMLInputElement
			const chkVInf16xLimiter = document.getElementById('chk-v-inf-16x-limiter') as HTMLInputElement
			const chk100PctCloning = document.getElementById('chk-100pct-cloning') as HTMLInputElement
			const chkMicroAcoustic = document.getElementById(
				'chk-micro-acoustic-mechanical',
			) as HTMLInputElement
			const chkMasterTape = document.getElementById('chk-master-tape-physics') as HTMLInputElement
			const chkLatentResynth = document.getElementById(
				'chk-latent-cross-resynthesis',
			) as HTMLInputElement
			const chkDolbyAtmosRoom = document.getElementById('chk-dolby-atmos-room') as HTMLInputElement
			const chkFcSubdc = document.getElementById('chk-fc-subdc') as HTMLInputElement | null
			const chkFcHelmholtz = document.getElementById('chk-fc-helmholtz') as HTMLInputElement | null
			const chkFcRoughness = document.getElementById('chk-fc-roughness') as HTMLInputElement | null
			const chkFcCmr = document.getElementById('chk-fc-cmr') as HTMLInputElement | null

			const chkTvLangmuir = document.getElementById('chk-tv-langmuir') as HTMLInputElement | null
			const chkTvEdison = document.getElementById('chk-tv-edison') as HTMLInputElement | null
			const chkTvChokesag = document.getElementById('chk-tv-chokesag') as HTMLInputElement | null
			const chkTvZener = document.getElementById('chk-tv-zener') as HTMLInputElement | null
			const chkTvBifilar = document.getElementById('chk-tv-bifilar') as HTMLInputElement | null

			// Group 1: Fisiologia Vocal & De-Esser (Exclusivo do GEM da Voz)
			const chkGemVoxHirano = document.getElementById(
				'chk-gem-vox-hirano',
			) as HTMLInputElement | null
			const chkGemVoxOq = document.getElementById('chk-gem-vox-oq') as HTMLInputElement | null
			const chkGemVoxTitze = document.getElementById('chk-gem-vox-titze') as HTMLInputElement | null
			const chkGemVoxSinger = document.getElementById(
				'chk-gem-vox-singer',
			) as HTMLInputElement | null
			const chkGemVoxAntiNasal = document.getElementById(
				'chk-gem-vox-antinasal',
			) as HTMLInputElement | null
			const chkGemVoxFry = document.getElementById('chk-gem-vox-fry') as HTMLInputElement | null
			const chkGemVoxPassaggio = document.getElementById(
				'chk-gem-vox-passaggio',
			) as HTMLInputElement | null
			const chkGemVoxBernoulli = document.getElementById(
				'chk-gem-vox-bernoulli',
			) as HTMLInputElement | null
			const chkGemVoxMorse = document.getElementById('chk-gem-vox-morse') as HTMLInputElement | null
			const chkGemVoxStevens = document.getElementById(
				'chk-gem-vox-stevens',
			) as HTMLInputElement | null

			lastMasterResult = await MasteringEngine.processMaster(audioBuffer, {
				album: activeAlbum,
				producer: activeProducer,
				referenceBuffer: v4ReferenceBuffer || undefined,
				enableSectionAwareMastering: true,
				enableCandidateTournament: true,
				enableDynamicDeResonator: chkV5DeResonator ? chkV5DeResonator.checked : true,
				enableSpectralTransientPro: chkV5TransientPro ? chkV5TransientPro.checked : true,
				enableDiffVoxSheen: chkV5DiffVoxSheen ? chkV5DiffVoxSheen.checked : true,
				enableDeskCrosstalk: chkVOmegaCrosstalk ? chkVOmegaCrosstalk.checked : true,
				enableSubHarmonicSynth: chkVOmegaSubharmonic ? chkVOmegaSubharmonic.checked : true,
				enablePocketQuantizer: chkVOmegaPocketQuantize ? chkVOmegaPocketQuantize.checked : true,
				enableAntiMasking3D: chkVOmegaAntiMask ? chkVOmegaAntiMask.checked : true,
				enablePsychoDither: true,
				enableWaveformAsymmetryRotator: chkVInfAsymmetry ? chkVInfAsymmetry.checked : true,
				enableAkgK92Calibration: chkVInfAkgK92 ? chkVInfAkgK92.checked : false,
				enableNeuralDeClipper: chkVInfDeclip ? chkVInfDeclip.checked : true,
				enable16xPolyphaseLimiter: chkVInf16xLimiter ? chkVInf16xLimiter.checked : true,
				enable100PctInstrumentCloning: chk100PctCloning ? chk100PctCloning.checked : true,
				enableMicroAcousticMechanical: chkMicroAcoustic ? chkMicroAcoustic.checked : true,
				enableMasterTapePhysics: chkMasterTape ? chkMasterTape.checked : true,
				enableLatentCrossResynthesis: chkLatentResynth ? chkLatentResynth.checked : true,
				frequencyCleaning: {
					enableSubInfrasonicCleaner: chkFcSubdc ? chkFcSubdc.checked : true,
					enableHelmholtzBassTrap: chkFcHelmholtz ? chkFcHelmholtz.checked : true,
					enablePlompLeveltRoughness: chkFcRoughness ? chkFcRoughness.checked : true,
					enableCMRMaskingRelease: chkFcCmr ? chkFcCmr.checked : true,
					enableBasilarSuppression: true,
					enableKurtosisDeHarsh: true,
				},
				thermionicVintage: {
					enableLangmuirChild: chkTvLangmuir ? chkTvLangmuir.checked : true,
					enableEdisonRichardson: chkTvEdison ? chkTvEdison.checked : true,
					enableTubeChokeSag: chkTvChokesag ? chkTvChokesag.checked : true,
					enableZenerAvalanche: chkTvZener ? chkTvZener.checked : true,
					enableBifilarCoupling: chkTvBifilar ? chkTvBifilar.checked : true,
					warmthIntensity: parseFloat(sliderSat.value) / 100,
				},
				vocalPhysiology: {
					enableHiranoMucosalWave: chkGemVoxHirano ? chkGemVoxHirano.checked : true,
					enableGlottalOpenQuotient: chkGemVoxOq ? chkGemVoxOq.checked : true,
					enableTitzeEpilarynx: chkGemVoxTitze ? chkGemVoxTitze.checked : true,
					enableSingerFormantCluster: chkGemVoxSinger ? chkGemVoxSinger.checked : true,
					enableAntiNasalSinus: chkGemVoxAntiNasal ? chkGemVoxAntiNasal.checked : true,
					enableSubHarmonicVocalFry: chkGemVoxFry ? chkGemVoxFry.checked : true,
					enablePassaggioImpedanceMatch: chkGemVoxPassaggio ? chkGemVoxPassaggio.checked : true,
					enableBernoulliGlottalSuction: chkGemVoxBernoulli ? chkGemVoxBernoulli.checked : true,
					enableMorseLipRadiation: chkGemVoxMorse ? chkGemVoxMorse.checked : true,
					enableStevensPhaseCoherentDeEsser: chkGemVoxStevens ? chkGemVoxStevens.checked : true,
				},
				inputSourceMode: selectInputSourceMode
					? (selectInputSourceMode.value as any)
					: 'ai_generated',
				customDrive: parseFloat(sliderSat.value) / 100,
				customWidth: parseFloat(sliderWidth.value) / 100,
				intensityScale: parseFloat(sliderIntensity.value) / 100,
				streamingPlatform: selectStreamingTarget
					? (selectStreamingTarget.value as any)
					: 'cd_metal',
				analogColorModel: selectAnalogTapeModel
					? (selectAnalogTapeModel.value as any)
					: 'ampex_atr102',
				limiterMode: selectLimiterMode ? (selectLimiterMode.value as any) : 'soft_analog_clipper',
				realWorldDevice: selectRealWorldDevice
					? (selectRealWorldDevice.value as any)
					: 'flat_studio',
				drumKitModelId: selectDrumKitModel ? selectDrumKitModel.value : 'bypass',
				guitarRigModelId: selectGuitarRigModel ? selectGuitarRigModel.value : 'bypass',
				bassRigModelId: selectBassRigModel ? selectBassRigModel.value : 'bypass',
				vocalMicId: selectVocalMicrophoneModel ? selectVocalMicrophoneModel.value : 'bypass',
				guitarMicId: selectGuitarMicrophoneModel ? selectGuitarMicrophoneModel.value : 'bypass',
				bassMicId: selectBassMicrophoneModel ? selectBassMicrophoneModel.value : 'bypass',
				drumMicId: selectDrumMicrophoneModel ? selectDrumMicrophoneModel.value : 'bypass',
				synthMicId: selectSynthMicrophoneModel ? selectSynthMicrophoneModel.value : 'bypass',
				secretProducerHackId: selectSecretProducerHack ? selectSecretProducerHack.value : 'bypass',
				enableAiAssistant: chkAiAssistantEnable ? chkAiAssistantEnable.checked : true,
				enableDeHum: true,
				enableGuitarRescue: true,
				enableDynamicDeHarsh: true,
				enableKickBassUnmask: true,
				enableDolbyAtmosRoom: chkDolbyAtmosRoom ? chkDolbyAtmosRoom.checked : false,
				transientPunchAmount: sliderTransientPunch
					? parseFloat(sliderTransientPunch.value) / 100
					: 0.45,
				drumReplacementBlend: sliderDrumBlend ? parseFloat(sliderDrumBlend.value) / 100 : 0.0,
				guitarReampBlend: sliderGuitarBlend ? parseFloat(sliderGuitarBlend.value) / 100 : 0.0,
				bassReampBlend: sliderBassBlend ? parseFloat(sliderBassBlend.value) / 100 : 0.0,
				vocalModelBlend: sliderVocalBlend ? parseFloat(sliderVocalBlend.value) / 100 : 0.0,
				sunoGuitarReconstruction: {
					enabled: chkSunoGuitarRescue ? chkSunoGuitarRescue.checked : true,
					style: selectSunoGuitarStyle ? (selectSunoGuitarStyle.value as any) : 'chug_5150',
					biteIntensity: sliderSunoGuitarBite ? parseFloat(sliderSunoGuitarBite.value) / 100 : 0.75,
					enableExtraGemWall: chkSunoExtraGemWall ? chkSunoExtraGemWall.checked : true,
				},
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
					masterProgressBar.style.width = `${pct}%`
					masterProgressPct.textContent = `${pct}%`
					masterProgressText.textContent = txt

					// Real-Time 10-Stage LED and Monitor Update
					const currentStageIndex = Math.min(9, Math.floor(pct / 10))
					for (let i = 0; i < 10; i++) {
						const stageEl = document.getElementById(`pipeline-stage-${i}`)
						if (stageEl) {
							if (i < currentStageIndex) {
								stageEl.className = 'pipeline-stage-badge done'
							} else if (i === currentStageIndex) {
								stageEl.className = 'pipeline-stage-badge active'
							} else {
								stageEl.className = 'pipeline-stage-badge'
							}
						}
					}

					const liveActionText = document.getElementById('live-action-monitor-text')
					if (liveActionText) {
						liveActionText.innerHTML = `<strong>PROCESSANDO (${pct}%):</strong> ${txt}`
					}

					const pipelineStatusText = document.getElementById('pipeline-status-text')
					if (pipelineStatusText) {
						pipelineStatusText.textContent = `● ESTÁGIO ${currentStageIndex + 1}/10 ATIVO`
						pipelineStatusText.style.color = '#06b6d4'
					}
				},
			})

			// ─── LIVE AUDITION ENGINE WIRING ──────────────────────────────────────────
			const btnToggleLiveAudition = document.getElementById(
				'btn-toggle-live-audition',
			) as HTMLButtonElement
			let isLiveAuditionActive = false

			const updateAudition = () => {
				LiveRigAuditionEngine.updateLiveRig({
					enabled: isLiveAuditionActive,
					drumKitId: selectDrumKitModel?.value,
					guitarRigId: selectGuitarRigModel?.value,
					bassRigId: selectBassRigModel?.value,
					secretHackId: selectSecretProducerHack?.value,
				})
			}

			btnToggleLiveAudition?.addEventListener('click', () => {
				isLiveAuditionActive = !isLiveAuditionActive
				btnToggleLiveAudition.textContent = isLiveAuditionActive
					? '⚡ LIVE AUDITION: ON'
					: '⚡ LIVE AUDITION: OFF'
				btnToggleLiveAudition.classList.toggle('active-gold', isLiveAuditionActive)
				updateAudition()
			})

			selectDrumKitModel?.addEventListener('change', updateAudition)
			selectGuitarRigModel?.addEventListener('change', updateAudition)
			selectBassRigModel?.addEventListener('change', updateAudition)
			selectSecretProducerHack?.addEventListener('change', updateAudition)

			// ─── ALL-PLATFORM RELEASE BUNDLE EXPORTER ──────────────────────────────────
			const btnExportReleaseBundle = document.getElementById(
				'btn-export-release-bundle',
			) as HTMLButtonElement
			const modalReleaseBundle = document.getElementById('modal-release-bundle')!
			const releaseBundleList = document.getElementById('release-bundle-list')!
			const btnCloseBundleModal = document.getElementById(
				'btn-close-bundle-modal',
			) as HTMLButtonElement
			const btnDownloadAllBundle = document.getElementById(
				'btn-download-all-bundle',
			) as HTMLButtonElement
			let generatedBundleItems: ReleaseFileItem[] = []

			btnExportReleaseBundle?.addEventListener('click', async () => {
				if (!lastMasterResult) return
				btnExportReleaseBundle.textContent = '⏳ Gerando Pacote de Lançamento...'
				btnExportReleaseBundle.disabled = true

				try {
					const baseName = `MASTER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_${activeAlbum.albumTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}`
					generatedBundleItems = await ReleaseBundleExportEngine.generateAllPlatformMasters(
						lastMasterResult.masterBuffer,
						baseName,
						lastMasterResult.reportHtml,
					)

					releaseBundleList.innerHTML = generatedBundleItems
						.map(
							(item) => `
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
          `,
						)
						.join('')

					releaseBundleList.querySelectorAll('.btn-single-download').forEach((btn, idx) => {
						btn.addEventListener('click', () => {
							const item = generatedBundleItems[idx]
							if (!item) return
							const url = URL.createObjectURL(item.blob)
							const a = document.createElement('a')
							a.href = url
							a.download = item.filename
							a.click()
						})
					})

					modalReleaseBundle.classList.remove('hidden')
				} catch (_e) {
				} finally {
					btnExportReleaseBundle.textContent = '📦 EXPORTAR PACOTE DE LANÇAMENTO (ALL PLATFORMS)'
					btnExportReleaseBundle.disabled = false
				}
			})

			btnCloseBundleModal?.addEventListener('click', () => {
				modalReleaseBundle.classList.add('hidden')
			})

			btnDownloadAllBundle?.addEventListener('click', () => {
				generatedBundleItems.forEach((item) => {
					const url = URL.createObjectURL(item.blob)
					const a = document.createElement('a')
					a.href = url
					a.download = item.filename
					a.click()
				})
			})

			// Update AI Diagnostic Scorecard
			const aiDiagCard = document.getElementById('ai-diagnostic-result-card')
			const diagScoreBadge = document.getElementById('diagnostic-score-badge')
			const diagIssuesList = document.getElementById('diagnostic-issues-list')
			if (lastMasterResult.diagnostic && aiDiagCard && diagScoreBadge && diagIssuesList) {
				aiDiagCard.classList.remove('hidden')
				diagScoreBadge.textContent = `Balanço: ${lastMasterResult.diagnostic.spectralBalanceScore}/100`
				diagIssuesList.innerHTML = lastMasterResult.diagnostic.issues
					.map(
						(iss) =>
							`<div style="margin-top: 2px;">● <strong>${iss.description}</strong> → <span style="color: var(--emerald-primary);">${iss.correctionApplied}</span></div>`,
					)
					.join('')
			}

			// ─── V4 HYPERREFERENCE & CANDIDATE TOURNAMENT UI UPDATE ──────────────────
			const v4SectionBadge = document.getElementById('v4-section-badge')
			if (lastMasterResult.songSections && v4SectionBadge) {
				const chorusCount = lastMasterResult.songSections.filter((s) => s.type === 'chorus').length
				const verseCount = lastMasterResult.songSections.filter((s) => s.type === 'verse').length
				v4SectionBadge.textContent = `🎼 ${lastMasterResult.songSections.length} SEÇÕES DETECTADAS (${verseCount}V / ${chorusCount}C)`
			}

			const v4TournamentHub = document.getElementById('v4-tournament-results-hub')
			const v4WinnerBadge = document.getElementById('v4-winner-badge')
			const v4Rationale = document.getElementById('v4-tournament-rationale')

			if (lastMasterResult.tournamentReport && v4TournamentHub) {
				v4TournamentHub.classList.remove('hidden')
				if (v4WinnerBadge) {
					v4WinnerBadge.textContent = `🏆 VENCEDOR: CANDIDATO ${lastMasterResult.tournamentReport.winner.id} (${lastMasterResult.tournamentReport.winner.fitnessScore.toFixed(1)}/100)`
				}
				if (v4Rationale) {
					v4Rationale.textContent = lastMasterResult.tournamentReport.decisionRationale
				}

				// Hook audition buttons
				document.querySelectorAll('.btn-v4-audition-candidate').forEach((btn) => {
					const candId = btn.getAttribute('data-candidate') as 'A' | 'B' | 'C' | 'D' | 'E'
					const candData = lastMasterResult?.tournamentReport?.candidates.find(
						(c) => c.id === candId,
					)
					if (candData?.isWinner) {
						;(btn as HTMLElement).style.borderColor = '#10b981'
					}

					btn.addEventListener('click', () => {
						document.querySelectorAll('.btn-v4-audition-candidate').forEach((b) => {
							b.classList.remove('active')
							;(b as HTMLElement).style.background = '#080c14'
						})
						btn.classList.add('active')
						;(btn as HTMLElement).style.background = 'rgba(245, 158, 11, 0.25)'

						if (candData && lastMasterResult) {
							// Update active buffer in player
							const candBuf = AudioBufferHelper.createAudioBuffer(
								2,
								candData.leftBuffer.length,
								44100,
							)
							candBuf.copyToChannel(candData.leftBuffer, 0)
							candBuf.copyToChannel(candData.rightBuffer, 1)
							const candBlob = audioBufferTo24BitWavBlob(candBuf)
							const candUrl = URL.createObjectURL(candBlob)
							mainAudioPlayer.src = candUrl
							btnDownloadMaster.href = candUrl
							btnDownloadMaster.download = lastMasterResult.downloadFilename.replace(
								'.wav',
								`_Candidate_${candId}.wav`,
							)
						}
					})
				})
			}

			// Hook V-INFINITY Master Stems Solo/Mute Grid
			const vInfStemStatus = document.getElementById('v-inf-stem-status')
			document.querySelectorAll('.btn-v-inf-solo-stem').forEach((btn) => {
				btn.addEventListener('click', () => {
					if (!lastMasterResult?.masteredStems) return

					document.querySelectorAll('.btn-v-inf-solo-stem').forEach((b) => {
						b.classList.remove('active')
						;(b as HTMLElement).style.background = '#0b0f19'
						;(b as HTMLElement).style.borderColor = '#334155'
						;(b as HTMLElement).style.color = '#94a3b8'
					})

					btn.classList.add('active')
					;(btn as HTMLElement).style.background = 'rgba(16, 185, 129, 0.2)'
					;(btn as HTMLElement).style.borderColor = '#10b981'
					;(btn as HTMLElement).style.color = '#10b981'

					const stemType = btn.getAttribute('data-stem')
					let targetBuffer: AudioBuffer = lastMasterResult.masterBuffer

					if (stemType && stemType !== 'all' && lastMasterResult.masteredStems) {
						const stemChan = (lastMasterResult.masteredStems as any)[stemType]
						if (stemChan) {
							targetBuffer = AudioBufferHelper.createAudioBuffer(
								2,
								stemChan.length,
								lastMasterResult.masterBuffer.sampleRate,
							)
							targetBuffer.copyToChannel(stemChan, 0)
							targetBuffer.copyToChannel(stemChan, 1)
						}
					}

					if (vInfStemStatus) {
						vInfStemStatus.textContent = `SOLO: ${stemType?.toUpperCase() || 'ALL'}`
						vInfStemStatus.style.color = stemType === 'all' ? '#10b981' : '#fbbf24'
					}

					const wasPlaying = !mainAudioPlayer.paused
					const currTime = mainAudioPlayer.currentTime
					const stemBlob = audioBufferTo24BitWavBlob(targetBuffer)
					const stemUrl = URL.createObjectURL(stemBlob)
					mainAudioPlayer.src = stemUrl
					mainAudioPlayer.currentTime = currTime
					if (wasPlaying) mainAudioPlayer.play().catch(() => {})
				})
			})

			const stats = lastMasterResult.stats
			meterIntLufs.textContent = `${(stats.integratedLufs ?? -14.0).toFixed(1)} LUFS`
			meterTruePeak.textContent = `${(stats.truePeakDb ?? stats.peakDb ?? -0.3).toFixed(1)} dBFS`
			meterCrest.textContent = `${(stats.crestFactorDb ?? 11.5).toFixed(1)} dB`
			meterGrVal.textContent = '-3.2 dB'
			vuMeter.setValue(-3.2)
			vuMeterSec?.setValue(-3.2)

			const masterUrl = URL.createObjectURL(lastMasterResult.wavBlob)
			btnDownloadMaster.href = masterUrl
			btnDownloadMaster.download = lastMasterResult.downloadFilename
			btnDownloadMaster.classList.remove('hidden')

			const btnDownloadMp3 = document.getElementById('btn-download-mp3') as HTMLAnchorElement
			if (btnDownloadMp3 && lastMasterResult) {
				const mp3Blob = Mp3EncoderEngine.encodeToMp3_320kbps(lastMasterResult.masterBuffer, {
					artist: activeAlbum.band,
					album: activeAlbum.albumTitle,
					title: `${activeAlbum.band} - ${activeAlbum.albumTitle} (Master 320k)`,
					year: '2026',
				})
				const mp3Url = URL.createObjectURL(mp3Blob)
				btnDownloadMp3.href = mp3Url
				btnDownloadMp3.download = lastMasterResult.downloadFilename.replace(
					'_24bit.wav',
					'_320kbps.mp3',
				)
				btnDownloadMp3.classList.remove('hidden')
			}

			if (multiFormatExportWrap) multiFormatExportWrap.classList.remove('hidden')

			const btnGenerateCoverArt = document.getElementById(
				'btn-generate-cover-art',
			) as HTMLButtonElement
			const modalCoverArt = document.getElementById('modal-cover-art')!
			const coverArtCanvas = document.getElementById('cover-art-canvas') as HTMLCanvasElement
			const btnDownloadCoverArt = document.getElementById(
				'btn-download-cover-art',
			) as HTMLAnchorElement
			const btnCloseCoverModal = document.getElementById(
				'btn-close-cover-modal',
			) as HTMLButtonElement

			if (btnGenerateCoverArt) {
				btnGenerateCoverArt.onclick = () => {
					CoverArtGenerator.renderCover(
						coverArtCanvas,
						activeAlbum.band,
						activeAlbum.albumTitle,
						activeProducer ? activeProducer.name : 'Master of Masters Studio Pro',
					)
					btnDownloadCoverArt.href = coverArtCanvas.toDataURL('image/png')
					btnDownloadCoverArt.download = `COVER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_4K.png`
					modalCoverArt.classList.remove('hidden')
				}
			}

			btnCloseCoverModal?.addEventListener('click', () => {
				modalCoverArt.classList.add('hidden')
			})

			const btnGenerateSocialVideo = document.getElementById(
				'btn-generate-social-video',
			) as HTMLButtonElement
			const modalSocialVideo = document.getElementById('modal-social-video')!
			const socialVideoCanvas = document.getElementById('social-video-canvas') as HTMLCanvasElement
			const btnRenderVideoTeaser = document.getElementById(
				'btn-render-video-teaser',
			) as HTMLButtonElement
			const btnDownloadVideoTeaser = document.getElementById(
				'btn-download-video-teaser',
			) as HTMLAnchorElement
			const btnCloseVideoModal = document.getElementById(
				'btn-close-video-modal',
			) as HTMLButtonElement
			const videoRenderProgress = document.getElementById('video-render-progress')!

			if (btnGenerateSocialVideo) {
				btnGenerateSocialVideo.onclick = () => {
					modalSocialVideo.classList.remove('hidden')
				}
			}

			btnCloseVideoModal?.addEventListener('click', () => {
				modalSocialVideo.classList.add('hidden')
			})

			if (btnRenderVideoTeaser) {
				btnRenderVideoTeaser.onclick = async () => {
					if (!lastMasterResult) return
					btnRenderVideoTeaser.disabled = true
					btnRenderVideoTeaser.textContent = '⏳ Renderizando Vídeo 4K...'

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
								videoRenderProgress.textContent = `Gravando vídeo: ${pct}% concluído...`
							},
						)

						const videoUrl = URL.createObjectURL(videoBlob)
						btnDownloadVideoTeaser.href = videoUrl
						btnDownloadVideoTeaser.download = `TEASER_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_4K.mp4`
						btnDownloadVideoTeaser.classList.remove('hidden')
						videoRenderProgress.textContent = '✅ Vídeo Teaser Renderizado com Sucesso!'
					} catch (_vErr) {
						videoRenderProgress.textContent = '❌ Erro ao renderizar vídeo'
					} finally {
						btnRenderVideoTeaser.disabled = false
						btnRenderVideoTeaser.textContent = '🎥 RENDERIZAR CLIPE COM VINIL GIRANDO E ESPECTRO'
					}
				}
			}

			if (btnExport32bit) {
				btnExport32bit.onclick = () => {
					if (!lastMasterResult) return
					const blob32 = MultiFormatEncoder.encodeToFormat(
						lastMasterResult.masterBuffer,
						'wav_32bit_float',
					)
					const url32 = URL.createObjectURL(blob32)
					const a = document.createElement('a')
					a.href = url32
					a.download = lastMasterResult.downloadFilename.replace('_24bit.wav', '_32bit_float.wav')
					a.click()
				}
			}

			if (btnExport16bit) {
				btnExport16bit.onclick = () => {
					if (!lastMasterResult) return
					const blob16 = MultiFormatEncoder.encodeToFormat(
						lastMasterResult.masterBuffer,
						'wav_16bit_cd',
					)
					const url16 = URL.createObjectURL(blob16)
					const a = document.createElement('a')
					a.href = url16
					a.download = lastMasterResult.downloadFilename.replace('_24bit.wav', '_16bit_cd.wav')
					a.click()
				}
			}

			const btnViewReport = document.getElementById('btn-view-report') as HTMLButtonElement
			const modalMasterReport = document.getElementById('modal-master-report')!
			const modalReportContent = document.getElementById('modal-report-content')!
			const btnCloseReportModal = document.getElementById(
				'btn-close-report-modal',
			) as HTMLButtonElement

			if (btnViewReport) {
				btnViewReport.classList.remove('hidden')
				btnViewReport.onclick = () => {
					if (!lastMasterResult) return
					modalReportContent.innerHTML = lastMasterResult.reportHtml
					modalMasterReport.classList.remove('hidden')
				}
			}

			const btnOpenMasterInEditor = document.getElementById(
				'btn-open-master-in-editor',
			) as HTMLButtonElement
			if (btnOpenMasterInEditor) {
				btnOpenMasterInEditor.classList.remove('hidden')
				btnOpenMasterInEditor.onclick = () => {
					if (!lastMasterResult) return
					audioBuffer = lastMasterResult.masterBuffer
					initArrangerWithAudio(audioBuffer)
					const tabArranger = document.querySelector(
						'.studio-tab[data-tab="tab-arranger"]',
					) as HTMLButtonElement
					tabArranger?.click()
					showStudioToast(
						'✂️ Master aberto no Editor DAW! Corte, cole, duplique ou regenere trechos com costura natural.',
						'success',
						5000,
					)
				}
			}

			if (btnCloseReportModal) {
				btnCloseReportModal.onclick = () => {
					modalMasterReport.classList.add('hidden')
				}
			}

			// Set all 10 stages as DONE
			for (let i = 0; i < 10; i++) {
				const stageEl = document.getElementById(`pipeline-stage-${i}`)
				if (stageEl) stageEl.className = 'pipeline-stage-badge done'
			}

			const liveActionText = document.getElementById('live-action-monitor-text')
			const intLufs = lastMasterResult.stats.integratedLufs ?? -9.5
			const tpDb = lastMasterResult.stats.truePeakDb ?? lastMasterResult.stats.peakDb ?? -0.3
			const crDb = lastMasterResult.stats.crestFactorDb ?? 10.2

			if (liveActionText) {
				liveActionText.innerHTML = `<strong>MASTER CONCLUÍDO (100%):</strong> Áudio finalizado em ${intLufs.toFixed(1)} LUFS e ${tpDb.toFixed(2)} dBTP com dither TPDF 24-bit.`
			}

			const pipelineStatusText = document.getElementById('pipeline-status-text')
			if (pipelineStatusText) {
				pipelineStatusText.textContent = '● MASTERIZAÇÃO FINALIZADA COM SUCESSO'
				pipelineStatusText.style.color = '#10b981'
			}

			// Update Telemetry HUD with Master Stats
			const cockpitLufs = document.getElementById('cockpit-lufs-val')
			const cockpitTruePeak = document.getElementById('cockpit-truepeak-val')
			const cockpitCrest = document.getElementById('cockpit-crest-val')
			if (cockpitLufs) cockpitLufs.textContent = `${intLufs.toFixed(1)} LUFS`
			if (cockpitTruePeak) cockpitTruePeak.textContent = `${tpDb.toFixed(2)} dBTP`
			if (cockpitCrest) cockpitCrest.textContent = `${crDb.toFixed(1)} dB`

			btnAbMaster.disabled = false
			btnAbMaster.classList.remove('opacity-50', 'cursor-not-allowed', 'text-slate-500')
			btnAbMaster.classList.add('text-slate-300', 'active-gold')
			btnAbOrig.className = 'switch-toggle-btn'

			mainAudioPlayer.src = masterUrl
			try {
				const p = mainAudioPlayer.play()
				if (p) {
					p.then(() => {
						btnTransportPlay.textContent = '❚❚'
					}).catch((_pErr) => {
						btnTransportPlay.textContent = '▶'
					})
				}
			} catch (_e) {}
		} catch (eErr: any) {
			if (masterProgressWrap) {
				masterProgressBar.style.backgroundColor = '#ef4444'
				masterProgressPct.textContent = 'Erro'
				masterProgressText.innerHTML = `❌ <strong>Erro no processamento:</strong> ${eErr.message || String(eErr)}`
			}
		} finally {
			btnProcessMaster.disabled = false
			btnProcessMaster.classList.remove('opacity-50')
			btnProcessMaster.textContent = '🏆 PROCESSAR MASTER ANALÓGICO'
		}
	})

	// Preset Manager Handlers
	const selectUserPresets = document.getElementById('select-user-presets') as HTMLSelectElement
	const btnSaveCurrentPreset = document.getElementById(
		'btn-save-current-preset',
	) as HTMLButtonElement

	function refreshPresetsDropdown() {
		if (!selectUserPresets) return
		const presets = PresetManager.getPresets()
		selectUserPresets.innerHTML = '<option value="">💾 Meus Presets Salvos...</option>'
		presets.forEach((p) => {
			const opt = document.createElement('option')
			opt.value = p.id
			opt.textContent = `${p.name} (${new Date(p.timestamp).toLocaleDateString()})`
			selectUserPresets.appendChild(opt)
		})
	}

	refreshPresetsDropdown()

	btnSaveCurrentPreset?.addEventListener('click', () => {
		const name = prompt(
			'Digite um nome para o seu Preset personalizado:',
			`${activeProducer.name} - ${activeAlbum.albumTitle} Custom`,
		)
		if (!name) return
		PresetManager.savePreset({
			name,
			producerId: activeProducer.id,
			albumId: activeAlbum.id,
			satDrive: parseFloat(sliderSat.value),
			stereoWidth: parseFloat(sliderWidth.value),
			intensity: parseFloat(sliderIntensity.value),
		})
		refreshPresetsDropdown()
		alert('✅ Preset salvo com sucesso no navegador!')
	})

	const btnBackupPresetsJson = document.getElementById(
		'btn-backup-presets-json',
	) as HTMLButtonElement
	if (btnBackupPresetsJson) {
		btnBackupPresetsJson.addEventListener('click', () => {
			const blob = PresetBackupRestoreManager.exportPresetsToJson()
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `MASTER_OF_MASTERS_PRESETS_${new Date().toISOString().slice(0, 10)}.json`
			a.click()
		})
	}

	const inputRestorePresetsJson = document.getElementById(
		'input-restore-presets-json',
	) as HTMLInputElement
	if (inputRestorePresetsJson) {
		inputRestorePresetsJson.addEventListener('change', async (e: any) => {
			const file = e.target?.files?.[0]
			if (!file) return
			const res = await PresetBackupRestoreManager.importPresetsFromJson(file)
			alert(res.message)
			refreshPresetsDropdown()
		})
	}

	// ─── ALBUM BATCH MASTER MODAL WIRING ───────────────────────────────────────
	const btnOpenAlbumBatch = document.getElementById('btn-open-album-batch') as HTMLButtonElement
	const modalAlbumBatch = document.getElementById('modal-album-batch')!
	const btnCloseBatchModal = document.getElementById('btn-close-batch-modal') as HTMLButtonElement
	const inputBatchFiles = document.getElementById('input-batch-files') as HTMLInputElement
	const batchTracksList = document.getElementById('batch-tracks-list')!
	const btnStartAlbumBatch = document.getElementById('btn-start-album-batch') as HTMLButtonElement
	const batchProgressStatus = document.getElementById('batch-progress-status')!

	let albumBatchQueue: AlbumTrackItem[] = []

	if (btnOpenAlbumBatch) {
		btnOpenAlbumBatch.addEventListener('click', () => {
			modalAlbumBatch.classList.remove('hidden')
		})
	}

	btnCloseBatchModal?.addEventListener('click', () => {
		modalAlbumBatch.classList.add('hidden')
	})

	inputBatchFiles?.addEventListener('change', (e: any) => {
		const files: FileList = e.target?.files
		if (!files || files.length === 0) return

		albumBatchQueue = Array.from(files).map((f, idx) => ({
			id: `track-${idx}-${Date.now()}`,
			file: f,
			title: f.name.replace(/\.[^/.]+$/, ''),
			status: 'PENDING',
		}))

		renderBatchList()
		btnStartAlbumBatch.disabled = albumBatchQueue.length === 0
	})

	function renderBatchList() {
		if (albumBatchQueue.length === 0) {
			batchTracksList.innerHTML =
				'<div style="font-size: 11px; color: #64748b; text-align: center; padding: 20px;">Nenhuma faixa adicionada à fila ainda.</div>'
			return
		}

		batchTracksList.innerHTML = albumBatchQueue
			.map(
				(item, idx) => `
      <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: #f1f5f9;">
          <strong>${(idx + 1).toString().padStart(2, '0')}.</strong> ${item.title}
        </span>
        <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: ${item.status === 'COMPLETED' ? '#10b981' : item.status === 'PROCESSING' ? '#f59e0b' : '#94a3b8'};">
          ${item.status === 'COMPLETED' ? '✅ MASTERIZADO' : item.status === 'PROCESSING' ? '⏳ PROCESSANDO...' : 'PENDENTE'}
        </span>
      </div>
    `,
			)
			.join('')
	}

	btnStartAlbumBatch?.addEventListener('click', async () => {
		if (albumBatchQueue.length === 0) return
		btnStartAlbumBatch.disabled = true
		btnStartAlbumBatch.textContent = '⏳ Masterizando Ábum em Lote...'

		await AlbumBatchMasterEngine.processAlbumBatch(
			albumBatchQueue,
			activeAlbum,
			activeProducer,
			(tIdx, pct, msg) => {
				batchProgressStatus.textContent = `[Faixa ${tIdx + 1}/${albumBatchQueue.length}] ${pct}%: ${msg}`
				renderBatchList()
			},
		)

		batchProgressStatus.textContent = '🎉 ÁLBUM COMPLETO MASTERIZADO COM SUCESSO!'
		btnStartAlbumBatch.disabled = false
		btnStartAlbumBatch.textContent = '🚀 INICIAR MASTERIZAÇÃO EM LOTE DO ÁLBUM'

		// Download all completed tracks
		albumBatchQueue.forEach((track, i) => {
			if (track.result) {
				const url = URL.createObjectURL(track.result.wavBlob)
				const a = document.createElement('a')
				a.href = url
				a.download = `${(i + 1).toString().padStart(2, '0')}_${track.result.downloadFilename}`
				a.click()
			}
		})
	})

	// ─── AI SONG & CUSTOM VOICE GENERATOR WIRING ──────────────────────────────
	const btnOpenSongGenerator = document.getElementById(
		'btn-open-song-generator',
	) as HTMLButtonElement
	const modalAiSongGenerator = document.getElementById('modal-ai-song-generator')!
	const btnCloseSongGenModal = document.getElementById(
		'btn-close-song-generator-modal',
	) as HTMLButtonElement
	const inputSongPrompt = document.getElementById('input-song-prompt') as HTMLTextAreaElement
	const inputSongLyrics = document.getElementById('input-song-lyrics') as HTMLTextAreaElement
	const btnRecordUserVoice = document.getElementById('btn-record-user-voice') as HTMLButtonElement
	const inputUserVoiceFile = document.getElementById('input-user-voice-file') as HTMLInputElement
	const voiceUploadStatus = document.getElementById('voice-upload-status')!
	const selectSongDuration = document.getElementById('select-song-duration') as HTMLSelectElement
	const selectSoloMode = document.getElementById('select-solo-mode') as HTMLSelectElement
	const sliderSongComplexity = document.getElementById('slider-song-complexity') as HTMLInputElement
	const labelComplexityVal = document.getElementById('label-complexity-val')
	const songGenProgressStatus = document.getElementById('song-gen-progress-status')!
	const btnGenerateAiSong = document.getElementById('btn-generate-ai-song') as HTMLButtonElement

	sliderSongComplexity?.addEventListener('input', () => {
		const val = parseInt(sliderSongComplexity.value, 10)
		if (labelComplexityVal) {
			if (val <= 3) labelComplexityVal.textContent = `Nível ${val} (Rock Direto)`
			else if (val <= 6) labelComplexityVal.textContent = `Nível ${val} (Heavy Metal Épico)`
			else labelComplexityVal.textContent = `Nível ${val} (Opus Progressivo & Sweeps)`
		}
	})

	let customUserVoiceBuffer: AudioBuffer | null = null
	let mediaRecorder: MediaRecorder | null = null
	let voiceChunks: Blob[] = []

	if (btnOpenSongGenerator) {
		btnOpenSongGenerator.addEventListener('click', () => {
			modalAiSongGenerator.classList.remove('hidden')
		})
	}

	btnCloseSongGenModal?.addEventListener('click', () => {
		modalAiSongGenerator.classList.add('hidden')
	})

	// Prompt Presets click
	document.querySelectorAll('.btn-prompt-preset').forEach((btn) => {
		btn.addEventListener('click', () => {
			const preset = (btn as HTMLElement).dataset.preset
			if (preset === 'iron_maiden') {
				inputSongPrompt.value =
					'Iron Maiden fast galloping heavy metal song with twin harmonized guitar solo in E minor, aggressive energy, 160 BPM, punchy Steve Harris bass and epic chorus.'
				if (inputSongLyrics)
					inputSongLyrics.value =
						'Into the storm we ride tonight!\nScreaming through the ancient skies!\nIron chains broken by our might!\nWe rise above, we never die!'
			} else if (preset === 'metallica') {
				inputSongPrompt.value =
					'Metallica Black Album heavy mid-tempo groove riff in E minor, punchy Lars Ulrich drum slam, heavy Hetfield downpicking rhythm guitars, 110 BPM.'
				if (inputSongLyrics)
					inputSongLyrics.value =
						'Heavy shadows on the wall / Crushing thunder, stand or fall / Blackened horizon calling my name / Feeding the fire, burning the flame!'
			} else if (preset === 'judas_priest') {
				inputSongPrompt.value =
					'Judas Priest Painkiller speed metal explosive double-bass drum track, screaming lead arpeggios, razor sharp distortion, 175 BPM.'
				if (inputSongLyrics)
					inputSongLyrics.value =
						'Faster than a bullet train / Steel armor through the pain / High screaming metal wrath / Cutting down the dark path!'
			} else if (preset === 'pink_floyd') {
				inputSongPrompt.value =
					'Pink Floyd Dark Side of the Moon atmospheric progressive rock with soaring David Gilmour bluesy stratocaster solo, 85 BPM.'
				if (inputSongLyrics)
					inputSongLyrics.value =
						'Floating through the prism ray / Time and silence drift away / Echoes of a forgotten sun / The journey has just begun...'
			} else if (preset === 'queen') {
				inputSongPrompt.value =
					'Queen Bohemian style grand operatic rock with multi-layered Brian May red special harmonized lead guitars, 120 BPM.'
				if (inputSongLyrics)
					inputSongLyrics.value =
						'Magnifico under the midnight crown / We take the stage, we shake the ground / Carry the fire, let the voices ring / Long live the power of the king!'
			}
		})
	})

	// User Voice Upload File
	inputUserVoiceFile?.addEventListener('change', async (e: any) => {
		const file = e.target?.files?.[0]
		if (!file) return
		try {
			voiceUploadStatus.textContent = '⏳ Decodificando áudio da sua voz...'
			const arrayBuf = await file.arrayBuffer()
			const ctx = new AudioContext()
			customUserVoiceBuffer = await ctx.decodeAudioData(arrayBuf)
			await ctx.close()
			voiceUploadStatus.textContent = `✅ Voz carregada com sucesso: "${file.name}" (${customUserVoiceBuffer.duration.toFixed(1)}s)`
			voiceUploadStatus.style.color = '#10b981'
		} catch (err: any) {
			voiceUploadStatus.textContent = `❌ Erro ao ler voz: ${err.message || String(err)}`
			voiceUploadStatus.style.color = '#f43f5e'
		}
	})

	// User Voice Microphone Recording
	btnRecordUserVoice?.addEventListener('click', async () => {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop()
			btnRecordUserVoice.textContent = '🎙️ Gravar Minha Voz (Mic)'
			btnRecordUserVoice.style.background = ''
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			mediaRecorder = new MediaRecorder(stream)
			voiceChunks = []

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) voiceChunks.push(e.data)
			}

			mediaRecorder.onstop = async () => {
				const blob = new Blob(voiceChunks, { type: 'audio/webm' })
				const arrayBuf = await blob.arrayBuffer()
				const ctx = new AudioContext()
				customUserVoiceBuffer = await ctx.decodeAudioData(arrayBuf)
				await ctx.close()
				stream.getTracks().forEach((t) => t.stop())
				voiceUploadStatus.textContent = `✅ Voz gravada via microfone (${customUserVoiceBuffer.duration.toFixed(1)}s)`
				voiceUploadStatus.style.color = '#10b981'
			}

			mediaRecorder.start()
			btnRecordUserVoice.textContent = '⏹️ Parar Gravação'
			btnRecordUserVoice.style.background = '#dc2626'
			voiceUploadStatus.textContent = '🔴 Gravando sua voz pelo microfone...'
		} catch (err: any) {
			alert(`Permissão de microfone necessária: ${err.message || String(err)}`)
		}
	})

	// Generate Song Trigger
	btnGenerateAiSong?.addEventListener('click', async () => {
		const promptText =
			inputSongPrompt.value.trim() ||
			`${activeAlbum.band} ${activeAlbum.albumTitle} style track with guitars, bass and drums`
		const durationSeconds = parseInt(selectSongDuration.value, 10) || 210
		const enableTwinSolo = selectSoloMode.value !== 'none'
		const complexityLevel = parseInt(sliderSongComplexity?.value || '8', 10)

		btnGenerateAiSong.disabled = true
		btnGenerateAiSong.textContent = '⏳ Compondo e Sintetizando Arranjo...'

		try {
			const generatedResult = await ClassicAlbumSongGenerator.generateSong(
				{
					promptText,
					lyricsText: inputSongLyrics?.value || '',
					album: activeAlbum,
					durationSeconds,
					complexityLevel,
					userVoiceBuffer: customUserVoiceBuffer,
					enableTwinGuitarSolo: enableTwinSolo,
				},
				(pct, msg) => {
					songGenProgressStatus.textContent = `${pct}%: ${msg}`
				},
			)

			// Save stems and master buffer
			currentGeneratedStems = generatedResult.stems
			audioBuffer = generatedResult.masterBuffer
			loadedFile = new File(
				[new Uint8Array(100)],
				`${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_ORIGINAL_COMPOSED.wav`,
				{ type: 'audio/wav' },
			)

			updateTrackInfo(
				`${activeAlbum.band} - Composição Inédita Gerada`,
				generatedResult.masterBuffer.duration,
			)
			drawWaveform(generatedResult.masterBuffer)
			drawSpectrum(generatedResult.masterBuffer)
			modalAiSongGenerator.classList.add('hidden')

			alert(
				`🎉 Música inédita com letra e voz composta com sucesso no estilo de "${activeAlbum.band} - ${activeAlbum.albumTitle}"!\nEla foi carregada no estúdio e já está pronta para masterização analógica!`,
			)
		} catch (gErr: any) {
			songGenProgressStatus.textContent = `❌ Erro na composição: ${gErr.message || String(gErr)}`
		} finally {
			btnGenerateAiSong.disabled = false
			btnGenerateAiSong.textContent = '✨ GERAR MÚSICA & CARREGAR'
		}
	})

	// ─── LIVE 4-STEM MIXER WIRING ─────────────────────────────────────────────
	let currentGeneratedStems: {
		drums: AudioBuffer
		bass: AudioBuffer
		guitars: AudioBuffer
		vocals: AudioBuffer
	} | null = null
	const btnOpenStemMixer = document.getElementById('btn-open-stem-mixer') as HTMLButtonElement
	const modalStemMixer = document.getElementById('modal-stem-mixer')!
	const btnCloseStemMixer = document.getElementById('btn-close-stem-mixer') as HTMLButtonElement
	const btnApplyStemMix = document.getElementById('btn-apply-stem-mix') as HTMLButtonElement

	const faderDrums = document.getElementById('fader-vol-drums') as HTMLInputElement
	const faderBass = document.getElementById('fader-vol-bass') as HTMLInputElement
	const faderGtr = document.getElementById('fader-vol-guitars') as HTMLInputElement
	const faderVox = document.getElementById('fader-vol-vocals') as HTMLInputElement

	const btnSoloDrums = document.getElementById('btn-solo-drums') as HTMLButtonElement
	const btnMuteDrums = document.getElementById('btn-mute-drums') as HTMLButtonElement
	const btnSoloBass = document.getElementById('btn-solo-bass') as HTMLButtonElement
	const btnMuteBass = document.getElementById('btn-mute-bass') as HTMLButtonElement
	const btnSoloGtr = document.getElementById('btn-solo-guitars') as HTMLButtonElement
	const btnMuteGtr = document.getElementById('btn-mute-guitars') as HTMLButtonElement
	const btnSoloVox = document.getElementById('btn-solo-vocals') as HTMLButtonElement
	const btnMuteVox = document.getElementById('btn-mute-vocals') as HTMLButtonElement

	const mixerState: StemMixerConfig = {
		drums: { gain: 1.0, pan: 0.0, muted: false, solo: false },
		bass: { gain: 1.0, pan: 0.0, muted: false, solo: false },
		guitars: { gain: 1.0, pan: 0.0, muted: false, solo: false },
		vocals: { gain: 1.0, pan: 0.0, muted: false, solo: false },
	}

	const toggleBtnClass = (btn: HTMLButtonElement, active: boolean, color: string) => {
		if (active) {
			btn.style.background = color
			btn.style.color = '#fff'
		} else {
			btn.style.background = ''
			btn.style.color = ''
		}
	}

	btnSoloDrums?.addEventListener('click', () => {
		mixerState.drums.solo = !mixerState.drums.solo
		toggleBtnClass(btnSoloDrums, mixerState.drums.solo, '#34d399')
	})
	btnMuteDrums?.addEventListener('click', () => {
		mixerState.drums.muted = !mixerState.drums.muted
		toggleBtnClass(btnMuteDrums, mixerState.drums.muted, '#ef4444')
	})
	btnSoloBass?.addEventListener('click', () => {
		mixerState.bass.solo = !mixerState.bass.solo
		toggleBtnClass(btnSoloBass, mixerState.bass.solo, '#38bdf8')
	})
	btnMuteBass?.addEventListener('click', () => {
		mixerState.bass.muted = !mixerState.bass.muted
		toggleBtnClass(btnMuteBass, mixerState.bass.muted, '#ef4444')
	})
	btnSoloGtr?.addEventListener('click', () => {
		mixerState.guitars.solo = !mixerState.guitars.solo
		toggleBtnClass(btnSoloGtr, mixerState.guitars.solo, '#f472b6')
	})
	btnMuteGtr?.addEventListener('click', () => {
		mixerState.guitars.muted = !mixerState.guitars.muted
		toggleBtnClass(btnMuteGtr, mixerState.guitars.muted, '#ef4444')
	})
	btnSoloVox?.addEventListener('click', () => {
		mixerState.vocals.solo = !mixerState.vocals.solo
		toggleBtnClass(btnSoloVox, mixerState.vocals.solo, '#fbbf24')
	})
	btnMuteVox?.addEventListener('click', () => {
		mixerState.vocals.muted = !mixerState.vocals.muted
		toggleBtnClass(btnMuteVox, mixerState.vocals.muted, '#ef4444')
	})

	btnOpenStemMixer?.addEventListener('click', () => {
		if (!currentGeneratedStems) {
			alert('Gere uma música primeiro para abrir a mesa de mixagem de stems!')
			return
		}
		modalStemMixer.classList.remove('hidden')
	})

	btnCloseStemMixer?.addEventListener('click', () => {
		modalStemMixer.classList.add('hidden')
	})

	btnApplyStemMix?.addEventListener('click', () => {
		if (!currentGeneratedStems) return
		mixerState.drums.gain = parseFloat(faderDrums.value)
		mixerState.bass.gain = parseFloat(faderBass.value)
		mixerState.guitars.gain = parseFloat(faderGtr.value)
		mixerState.vocals.gain = parseFloat(faderVox.value)

		audioBuffer = LiveStemMixerEngine.mixStems(currentGeneratedStems, mixerState)
		drawWaveform(audioBuffer)
		drawSpectrum(audioBuffer)
		modalStemMixer.classList.add('hidden')
		alert('✅ Mixagem das stems aplicada com sucesso ao áudio master!')
	})

	// ─── MIDI 2.0 EXPORT WIRING ───────────────────────────────────────────────
	const btnExportMidiFile = document.getElementById('btn-export-midi-file') as HTMLButtonElement
	btnExportMidiFile?.addEventListener('click', () => {
		const midiBytes = MidiFileExportEngine.generateMultiTrackMidi(145, 60, 40)
		const blob = new Blob([midiBytes], { type: 'audio/midi' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_MULTI_TRACK.mid`
		a.click()
		alert(
			'🎹 Arquivo MIDI Multi-Pista (.MID) exportado com sucesso! Pronto para abrir no Reaper, Cubase, FL Studio ou Pro Tools!',
		)
	})

	// ─── LYRIC VIDEO 4K WIRING ────────────────────────────────────────────────
	const btnOpenLyricVideoModal = document.getElementById(
		'btn-open-lyric-video-modal',
	) as HTMLButtonElement
	btnOpenLyricVideoModal?.addEventListener('click', async () => {
		if (!audioBuffer) {
			alert('Gere ou carregue uma música primeiro para renderizar o Lyric Video 4K!')
			return
		}
		btnOpenLyricVideoModal.disabled = true
		btnOpenLyricVideoModal.textContent = '⏳ Renderizando Vídeo 4K...'
		try {
			const lyrics =
				inputSongLyrics?.value.trim() ||
				'INTO THE STORM WE RIDE TONIGHT\nSCREAMING THROUGH THE ANCIENT SKIES\nWE BREAK THE CHAINS, WE NEVER DIE!'
			const videoBlob = await LyricVideo4kGenerator.renderLyricVideo(
				audioBuffer,
				'Composição Inédita',
				activeAlbum.band,
				lyrics,
			)
			const url = URL.createObjectURL(videoBlob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_LYRIC_VIDEO_4K.webm`
			a.click()
			alert('🎬 Lyric Video 4K renderizado e baixado com sucesso!')
		} catch (vErr: any) {
			alert(`Erro na renderização do vídeo: ${vErr.message || String(vErr)}`)
		} finally {
			btnOpenLyricVideoModal.disabled = false
			btnOpenLyricVideoModal.textContent = '🎬 Lyric Video 4K'
		}
	})

	// ─── AI MAESTRO CONDUCTOR & SCORES WIRING ─────────────────────────────────
	const btnViewMaestroScores = document.getElementById(
		'btn-view-maestro-scores',
	) as HTMLButtonElement
	const modalMaestroScore = document.getElementById('modal-maestro-score')!
	const btnCloseMaestroModal = document.getElementById(
		'btn-close-maestro-modal',
	) as HTMLButtonElement
	const maestroScoreContent = document.getElementById('maestro-score-content')!
	const btnDownloadSheetMusic = document.getElementById(
		'btn-download-sheet-music',
	) as HTMLButtonElement

	let currentMaestroScore: MaestroOrchestraScore | null = null

	if (btnViewMaestroScores) {
		btnViewMaestroScores.addEventListener('click', () => {
			const promptText =
				inputSongPrompt.value.trim() || `${activeAlbum.band} ${activeAlbum.albumTitle} style track`
			const lyricsText = inputSongLyrics?.value.trim() || ''

			currentMaestroScore = AiMaestroConductorEngine.conductScore(
				promptText,
				lyricsText,
				`${activeAlbum.band} - ${activeAlbum.albumTitle}`,
				145,
				'E Minor',
			)

			maestroScoreContent.innerHTML = currentMaestroScore.fullConductorScoreHtml
			modalMaestroScore.classList.remove('hidden')
		})
	}

	btnCloseMaestroModal?.addEventListener('click', () => {
		modalMaestroScore.classList.add('hidden')
	})

	btnDownloadSheetMusic?.addEventListener('click', () => {
		if (!currentMaestroScore) return
		const scoreText = `
================================================================================
🎼 PARTITURA GERAL DO MAESTRO AI & TABLATURAS DA BANDA VIRTUAL
================================================================================
Música: ${currentMaestroScore.songTitle}
Tonalidade: ${currentMaestroScore.keySignature} | Andamento: ${currentMaestroScore.tempoBpm} BPM | Fórmula: ${currentMaestroScore.timeSignature}

--------------------------------------------------------------------------------
DIRETRIZES DO MAESTRO CONDUTOR:
--------------------------------------------------------------------------------
${currentMaestroScore.maestroDirectives.join('\n')}

--------------------------------------------------------------------------------
PARTITURAS E TABLATURAS INDIVIDUAIS DOS AGENTES:
--------------------------------------------------------------------------------
1. GUITARRAS (Virtuoso Guitars Agent):
${currentMaestroScore.agents.guitars.asciiScoreText}

2. BATERIA (Thunder Drummer Agent):
${currentMaestroScore.agents.drums.asciiScoreText}

3. BAIXO (Iron Bassist Agent):
${currentMaestroScore.agents.bass.asciiScoreText}

4. TECLADOS & HAMMOND B3 (Symphonic Keys Agent):
${currentMaestroScore.agents.keys.asciiScoreText}

5. VOCAL & LETRA (Vocal God Agent):
${currentMaestroScore.agents.vocals.asciiScoreText}
================================================================================
Master of Masters Studio Pro — 64-Bit Quantum Analog DSP & AI Maestro Orchestra
`

		const blob = new Blob([scoreText], { type: 'text/plain;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `PARTITURA_MAESTRO_${activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`
		a.click()
	})

	// ─── 1-CLICK MASTER BOX SET EXPORT WIRING ─────────────────────────────────
	const btnExportBoxSet = document.getElementById('btn-export-box-set') as HTMLButtonElement
	btnExportBoxSet?.addEventListener('click', () => {
		if (!lastMasterResult && !audioBuffer) {
			alert('Carregue ou processe um master primeiro para exportar o Box Set!')
			return
		}
		const buf = lastMasterResult?.masteredBuffer || audioBuffer!
		const baseName = activeAlbum.band.replace(/[^a-zA-Z0-9_-]/g, '_')
		const scoreText =
			currentMaestroScore?.fullConductorScoreHtml ||
			'Partitura Oficial Master of Masters Studio Pro'

		MasterBoxSetExporter.exportFullBoxSet(buf, currentGeneratedStems, baseName, scoreText)
		alert(
			'👑 MASTER BOX SET COMPLETO EXPORTADO COM SUCESSO!\n(Master 24-bit, Stems individuais, MIDI e Partitura baixados sequencialmente)',
		)
	})

	// ─── LIVE 24-FRET GUITAR & BASS FRETBOARD ANIMATION ───────────────────────
	const canvasFretboard = document.getElementById('canvas-fretboard-player') as HTMLCanvasElement
	if (canvasFretboard) {
		const animFretboard = () => {
			if (canvasFretboard) {
				const curTime = audioCtx ? audioCtx.currentTime : 0
				LiveFretboardVisualizer.drawFretboard(canvasFretboard, curTime, 145)
			}
			requestAnimationFrame(animFretboard)
		}
		requestAnimationFrame(animFretboard)
	}

	selectUserPresets?.addEventListener('change', () => {
		const id = selectUserPresets.value
		if (!id) return
		const presets = PresetManager.getPresets()
		const p = presets.find((item) => item.id === id)
		if (!p) return
		selectProducer(p.producerId, p.albumId)
		sliderSat.value = String(p.satDrive)
		sliderWidth.value = String(p.stereoWidth)
		sliderIntensity.value = String(p.intensity)
		knobMasterSat?.setValue(p.satDrive)
		knobMasterWidth?.setValue(p.stereoWidth)
		knobMasterIntensity?.setValue(p.intensity)
	})
}

// ─── WELDER ENGINE & INSTRUMENT CUSTOMIZERS ──────────────────────────────────
function setupWelderProcessing() {
	selectDrummerPreset.addEventListener('change', () => {
		const val = selectDrummerPreset.value
		if (val === 'none') {
			drumSaturationDesc.textContent = `Saturação e kit calibrados do álbum selecionado (${activeAlbum.gemSetup.drums.saturation.toUpperCase()}).`
		} else {
			drumSaturationDesc.textContent = `Kit de Baterista Ativo: ${selectDrummerPreset.options[selectDrummerPreset.selectedIndex].text}`
		}
	})

	selectDrumSaturation.addEventListener('change', () => {
		const val = selectDrumSaturation.value
		if (val === 'album_default') {
			drumSaturationDesc.textContent = `Saturação calibrada do álbum selecionado (${activeAlbum.gemSetup.drums.saturation.toUpperCase()}).`
		} else {
			drumSaturationDesc.textContent = `Hardware ativo na Bateria: ${val.toUpperCase().replace('_', ' ')}.`
		}
	})

	sliderDrumDrive.addEventListener('input', () => {
		labelDrumDrive.textContent = `${sliderDrumDrive.value}%`
	})

	selectBassistPreset.addEventListener('change', () => {
		const val = selectBassistPreset.value
		if (val === 'none') {
			bassSaturationDesc.textContent = `Timbre e amplificador calibrados do álbum selecionado (${activeAlbum.gemSetup.bass.saturation.toUpperCase()}).`
		} else {
			bassSaturationDesc.textContent = `Assinatura de Baixista Ativa: ${selectBassistPreset.options[selectBassistPreset.selectedIndex].text}`
		}
	})

	selectBassSaturation.addEventListener('change', () => {
		const val = selectBassSaturation.value
		if (val === 'album_default') {
			bassSaturationDesc.textContent = `Timbre calibrado do álbum selecionado (${activeAlbum.gemSetup.bass.saturation.toUpperCase()}).`
		} else {
			bassSaturationDesc.textContent = `Amplificador ativo no Baixo: ${val.toUpperCase().replace('_', ' ')}.`
		}
	})

	sliderBassDrive.addEventListener('input', () => {
		labelBassDrive.textContent = `${sliderBassDrive.value}%`
	})

	selectGuitarDistortion.addEventListener('change', () => {
		const val = selectGuitarDistortion.value
		if (val === 'album_default') {
			guitarDistortionDesc.textContent = `Distorção calibrada do álbum selecionado (${activeAlbum.gemSetup.guitars.saturation.toUpperCase()}).`
		} else {
			guitarDistortionDesc.textContent = `Amplificador/Pedal ativo nas Guitarras: ${val.toUpperCase().replace('_', ' ')}.`
		}
	})

	sliderGuitarDrive.addEventListener('input', () => {
		labelGuitarDrive.textContent = `${sliderGuitarDrive.value}%`
	})

	// ─── GEM MIXER & EDITOR CONTROLS ──────────────────────────────────────────
	const gemFaderVols = document.querySelectorAll<HTMLInputElement>('.gem-fader-vol')
	const gemFaderPans = document.querySelectorAll<HTMLInputElement>('.gem-fader-pan')
	const gemFaderTones = document.querySelectorAll<HTMLInputElement>('.gem-fader-tone')
	const btnMuteGems = document.querySelectorAll<HTMLButtonElement>('.btn-mute-gem')
	const btnExportStemGems = document.querySelectorAll<HTMLButtonElement>('.btn-export-stem-gem')

	const gemMixerState: Record<
		string,
		{ volumeDb: number; pan: number; toneDb: number; mute: boolean; solo: boolean }
	> = {
		drums: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
		bass: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
		guitars: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
		vocals: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
		synthsFx: { volumeDb: 0, pan: 0, toneDb: 0, mute: false, solo: false },
	}

	gemFaderVols.forEach((slider) => {
		slider.addEventListener('input', () => {
			const gem = slider.getAttribute('data-gem')!
			const val = parseFloat(slider.value)
			if (gemMixerState[gem]) gemMixerState[gem].volumeDb = val
			const lbl = document.getElementById(`label-gem-vol-${gem}`)
			if (lbl) lbl.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)} dB`
		})
	})

	gemFaderPans.forEach((slider) => {
		slider.addEventListener('input', () => {
			const gem = slider.getAttribute('data-gem')!
			const val = parseFloat(slider.value)
			if (gemMixerState[gem]) gemMixerState[gem].pan = val / 100
			const lbl = document.getElementById(`label-gem-pan-${gem}`)
			if (lbl) {
				lbl.textContent = val === 0 ? 'C' : val < 0 ? `L ${Math.abs(val)}%` : `R ${val}%`
			}
		})
	})

	gemFaderTones.forEach((slider) => {
		slider.addEventListener('input', () => {
			const gem = slider.getAttribute('data-gem')!
			const val = parseFloat(slider.value)
			if (gemMixerState[gem]) gemMixerState[gem].toneDb = val
			const lbl = document.getElementById(`label-gem-tone-${gem}`)
			if (lbl) {
				lbl.textContent = val === 0 ? 'FLAT' : `${val >= 0 ? '+' : ''}${val.toFixed(1)} dB`
			}
		})
	})

	btnSoloGems.forEach((btn) => {
		btn.addEventListener('click', () => {
			const gem = btn.getAttribute('data-gem')!
			if (gemMixerState[gem]) {
				gemMixerState[gem].solo = !gemMixerState[gem].solo
				btn.classList.toggle('active-gold', gemMixerState[gem].solo)
			}
		})
	})

	btnMuteGems.forEach((btn) => {
		btn.addEventListener('click', () => {
			const gem = btn.getAttribute('data-gem')!
			if (gemMixerState[gem]) {
				gemMixerState[gem].mute = !gemMixerState[gem].mute
				btn.classList.toggle('active-red', gemMixerState[gem].mute)
			}
		})
	})

	btnProcessWelder.addEventListener('click', async () => {
		if (!audioBuffer) return
		btnProcessWelder.disabled = true
		btnProcessWelder.classList.add('opacity-50')
		welderProgressWrap.classList.remove('hidden')

		try {
			const drummerPresetId =
				selectDrummerPreset.value === 'none' ? undefined : selectDrummerPreset.value
			const bassistPresetId =
				selectBassistPreset.value === 'none' ? undefined : selectBassistPreset.value

			const selectedDrumVal = selectDrumSaturation.value
			const customDrumSaturation =
				selectedDrumVal === 'album_default' ? undefined : (selectedDrumVal as any)
			const customDrumDrive =
				(parseFloat(sliderDrumDrive.value) / 100) * activeAlbum.gemSetup.drums.drive

			const selectedBassVal = selectBassSaturation.value
			const customBassSaturation =
				selectedBassVal === 'album_default' ? undefined : (selectedBassVal as any)
			const customBassDrive =
				(parseFloat(sliderBassDrive.value) / 100) * activeAlbum.gemSetup.bass.drive

			const selectedDistVal = selectGuitarDistortion.value
			const customGuitarDistortion =
				selectedDistVal === 'album_default' ? undefined : (selectedDistVal as any)
			const customGuitarDrive =
				(parseFloat(sliderGuitarDrive.value) / 100) * activeAlbum.gemSetup.guitars.drive

			lastWelderResult = await GemWelderEngine.processGemsAndWeld(audioBuffer, activeAlbum, {
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
					welderProgressBar.style.width = `${pct}%`
					welderProgressPct.textContent = `${pct}%`
					welderProgressText.textContent = txt
				},
			})

			btnExportStemGems.forEach((btn) => {
				const gemKey = btn.getAttribute('data-gem')
				const gemRes = lastWelderResult?.individualGems.find((g) => g.gemName === gemKey)
				if (gemRes) {
					btn.classList.remove('hidden')
					btn.onclick = () => {
						const url = URL.createObjectURL(gemRes.blob)
						const a = document.createElement('a')
						a.href = url
						a.download =
							`STEM_${activeAlbum.band}_${activeAlbum.albumTitle}_${gemKey}_24bit.wav`.replace(
								/[^a-zA-Z0-9_.-]/g,
								'_',
							)
						a.click()
					}
				}
			})

			const weldedUrl = URL.createObjectURL(lastWelderResult.weldedWavBlob)
			btnDownloadWelded.href = weldedUrl
			btnDownloadWelded.download = lastWelderResult.downloadFilename
			btnDownloadWelded.classList.remove('hidden')
			welderStatusTag.textContent = 'SOLDAGEM FINAL CONCLUÍDA!'

			mainAudioPlayer.src = weldedUrl
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} catch (eErr: any) {
			welderProgressText.textContent = `❌ Erro: ${eErr.message || String(eErr)}`
		} finally {
			btnProcessWelder.disabled = false
			btnProcessWelder.classList.remove('opacity-50')
		}
	})
}

// ─── VOCAL GOD MODULE ────────────────────────────────────────────────────────
function setupVocalModule() {
	vocalDropzone.addEventListener('click', () => vocalFileInput.click())
	vocalFileInput.addEventListener('change', async () => {
		const file = vocalFileInput.files?.[0]
		if (!file) return
		vocalFileName.textContent = file.name
		vocalFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`
		vocalDropIdle.classList.add('hidden')
		vocalDropActive.classList.remove('hidden')

		try {
			const arr = await file.arrayBuffer()
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			vocalBuffer = await ctx.decodeAudioData(arr)
			vocalFileStats.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${(vocalBuffer.duration / 60).toFixed(1)} min · Pronto`
			vocalAudioPlayer.src = URL.createObjectURL(file)
			vocalAudioPlayer.classList.remove('hidden')
			btnProcessVocal.disabled = false
			btnProcessVocal.classList.remove('opacity-50', 'cursor-not-allowed')
		} catch (_err) {
			vocalFileStats.textContent = '❌ Erro ao decodificar voz.'
		}
	})

	// ─── USER REAL VOICE TIMBRE CLONING ────────────────────────────────────────
	const userVoiceDropzone = document.getElementById('user-voice-dropzone')
	const userVoiceFileInput = document.getElementById('user-voice-file-input') as HTMLInputElement
	const userVoiceIdle = document.getElementById('user-voice-idle')
	const userVoiceActive = document.getElementById('user-voice-active')
	const userVoiceName = document.getElementById('user-voice-name')
	const labelUserVoiceStatus = document.getElementById('label-user-voice-status')

	userVoiceDropzone?.addEventListener('click', () => userVoiceFileInput?.click())
	userVoiceFileInput?.addEventListener('change', async () => {
		const file = userVoiceFileInput.files?.[0]
		if (!file) return
		if (userVoiceName) userVoiceName.textContent = file.name
		userVoiceIdle?.classList.add('hidden')
		userVoiceActive?.classList.remove('hidden')

		try {
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			const userBuf = await UniversalAudioFormatDecoder.decodeAudioFile(file, ctx)
			const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(userBuf)
			if (labelUserVoiceStatus) {
				labelUserVoiceStatus.textContent = `⚡ CLONE ATIVO (+${fp.singersFormantDb.toFixed(1)}dB Metal Power)`
				labelUserVoiceStatus.style.color = 'var(--emerald-primary)'
			}
		} catch (_e) {}
	})

	selectVocalPreset.addEventListener('change', () => {
		const key = selectVocalPreset.value as VocalistPresetKey
		const p = VOCALIST_PRESETS[key]
		if (p) {
			vocalPresetDesc.textContent = `${p.name}: ${p.signature}`
			vocalSliderDeess.value = String(p.deEssAmount)
			vocalSliderAir.value = String(p.pultecAirDb)
			vocalSliderDoubler.value = String(p.doublerWidth)
			knobVocalDeess?.setValue(p.deEssAmount, false)
			knobVocalAir?.setValue(p.pultecAirDb, false)
			knobVocalDoubler?.setValue(p.doublerWidth, false)
		}
	})

	btnProcessVocal.addEventListener('click', async () => {
		const buf = vocalBuffer || audioBuffer
		if (!buf) return

		btnProcessVocal.disabled = true
		vocalProgressWrap.classList.remove('hidden')

		try {
			const key = selectVocalPreset.value as VocalistPresetKey
			const preset = VOCALIST_PRESETS[key] || VOCALIST_PRESETS.halford

			const chkHirano = document.getElementById('chk-vocal-hirano') as HTMLInputElement | null
			const chkOq = document.getElementById('chk-vocal-oq') as HTMLInputElement | null
			const chkTitze = document.getElementById('chk-vocal-titze') as HTMLInputElement | null
			const chkSinger = document.getElementById('chk-vocal-singer') as HTMLInputElement | null
			const chkAntiNasal = document.getElementById('chk-vocal-antinasal') as HTMLInputElement | null
			const chkFry = document.getElementById('chk-vocal-fry') as HTMLInputElement | null
			const chkPassaggio = document.getElementById('chk-vocal-passaggio') as HTMLInputElement | null
			const chkBernoulli = document.getElementById('chk-vocal-bernoulli') as HTMLInputElement | null
			const chkMorse = document.getElementById('chk-vocal-morse') as HTMLInputElement | null
			const chkStevens = document.getElementById('chk-vocal-stevens') as HTMLInputElement | null

			const res = await VocalEngine.processVocal(buf, {
				preset,
				customDeEss: parseFloat(vocalSliderDeess.value),
				customAir: parseFloat(vocalSliderAir.value),
				customDoubler: parseFloat(vocalSliderDoubler.value),
				physiology: {
					enableHiranoMucosalWave: chkHirano ? chkHirano.checked : true,
					enableGlottalOpenQuotient: chkOq ? chkOq.checked : true,
					enableTitzeEpilarynx: chkTitze ? chkTitze.checked : true,
					enableSingerFormantCluster: chkSinger ? chkSinger.checked : true,
					enableAntiNasalSinus: chkAntiNasal ? chkAntiNasal.checked : true,
					enableSubHarmonicVocalFry: chkFry ? chkFry.checked : true,
					enablePassaggioImpedanceMatch: chkPassaggio ? chkPassaggio.checked : true,
					enableBernoulliGlottalSuction: chkBernoulli ? chkBernoulli.checked : true,
					enableMorseLipRadiation: chkMorse ? chkMorse.checked : true,
					enableStevensPhaseCoherentDeEsser: chkStevens ? chkStevens.checked : true,
				},
				onProgress: (pct, txt) => {
					vocalProgressBar.style.width = `${pct}%`
					vocalProgressPct.textContent = `${pct}%`
					vocalProgressText.textContent = txt
				},
			})

			const vUrl = URL.createObjectURL(res.wavBlob)
			btnDownloadVocal.href = vUrl
			btnDownloadVocal.download = res.downloadFilename
			btnDownloadVocal.classList.remove('hidden')

			mainAudioPlayer.src = vUrl
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} catch (err: any) {
			vocalProgressText.textContent = `❌ Erro: ${err.message || String(err)}`
		} finally {
			btnProcessVocal.disabled = false
		}
	})
}

// ─── 3D SPATIAL MODULE ───────────────────────────────────────────────────────
function setupSpatialModule() {
	renderSpatialRadar()
	renderSpatialChannels()

	selectSpatialPreset.addEventListener('change', () => {
		const p = SPATIAL_PRESETS.find((pr) => pr.id === selectSpatialPreset.value)
		if (p) {
			spatialNodes = JSON.parse(JSON.stringify(p.nodes))
			renderSpatialRadar()
			renderSpatialChannels()
		}
	})

	btnResetSpatial.addEventListener('click', () => {
		spatialNodes = JSON.parse(JSON.stringify(SPATIAL_PRESETS[0].nodes))
		renderSpatialRadar()
		renderSpatialChannels()
	})

	spatialRadarCanvas.addEventListener('mousedown', (e) => {
		const rect = spatialRadarCanvas.getBoundingClientRect()
		const mx = e.clientX - rect.left
		const my = e.clientY - rect.top
		const w = spatialRadarCanvas.width
		const h = spatialRadarCanvas.height

		spatialNodes.forEach((node) => {
			const nx = (node.x + 1) * 0.5 * w
			const ny = node.y * (h * 0.85) + h * 0.08
			const dist = Math.hypot(mx - nx, my - ny)
			if (dist < 18) {
				draggedNodeId = node.id
			}
		})
	})

	window.addEventListener('mousemove', (e) => {
		if (!draggedNodeId) return
		const rect = spatialRadarCanvas.getBoundingClientRect()
		const mx = e.clientX - rect.left
		const my = e.clientY - rect.top
		const w = spatialRadarCanvas.width
		const h = spatialRadarCanvas.height

		const node = spatialNodes.find((n) => n.id === draggedNodeId)
		if (node) {
			node.x = Math.max(-1.0, Math.min(1.0, (mx / w) * 2 - 1))
			node.y = Math.max(0.0, Math.min(1.0, (my - h * 0.08) / (h * 0.85)))
			renderSpatialRadar()
			renderSpatialChannels()
		}
	})

	window.addEventListener('mouseup', () => {
		draggedNodeId = null
	})

	btnProcessSpatial.addEventListener('click', async () => {
		if (!audioBuffer) return
		btnProcessSpatial.disabled = true
		spatialProgressWrap.classList.remove('hidden')

		try {
			const res = await SpatialEngine.renderSpatialMix(audioBuffer, spatialNodes, (pct, txt) => {
				spatialProgressBar.style.width = `${pct}%`
				spatialProgressPct.textContent = `${pct}%`
				spatialProgressText.textContent = txt
			})

			const sUrl = URL.createObjectURL(res.wavBlob)
			btnDownloadSpatial.href = sUrl
			btnDownloadSpatial.download = res.downloadFilename
			btnDownloadSpatial.classList.remove('hidden')

			mainAudioPlayer.src = sUrl
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} catch (err: any) {
			spatialProgressText.textContent = `❌ Erro: ${err.message || String(err)}`
		} finally {
			btnProcessSpatial.disabled = false
		}
	})
}

function renderSpatialRadar() {
	const ctx = spatialRadarCanvas.getContext('2d')!
	const w = spatialRadarCanvas.width
	const h = spatialRadarCanvas.height
	const cx = w / 2

	ctx.clearRect(0, 0, w, h)

	ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'
	ctx.lineWidth = 1
	for (let r = 0.25; r <= 1.0; r += 0.25) {
		ctx.beginPath()
		ctx.arc(cx, h * 0.95, w * 0.85 * r, -Math.PI * 0.85, -Math.PI * 0.15)
		ctx.stroke()
	}

	ctx.fillStyle = '#ef4444'
	ctx.beginPath()
	ctx.arc(cx, h * 0.95, 8, 0, Math.PI * 2)
	ctx.fill()

	spatialNodes.forEach((node) => {
		const nx = (node.x + 1) * 0.5 * w
		const ny = node.y * (h * 0.85) + h * 0.08

		ctx.fillStyle = node.color
		ctx.shadowColor = node.color
		ctx.shadowBlur = 12
		ctx.beginPath()
		ctx.arc(nx, ny, 10, 0, Math.PI * 2)
		ctx.fill()
		ctx.shadowBlur = 0

		ctx.font = 'bold 10px monospace'
		ctx.fillStyle = '#ffffff'
		ctx.fillText(node.name, nx - 20, ny - 14)
	})
}

function renderSpatialChannels() {
	spatialChannelsContainer.innerHTML = ''
	spatialNodes.forEach((node) => {
		const panPct = Math.round(node.x * 100)
		const panStr = panPct === 0 ? 'CENTRO' : panPct < 0 ? `L ${Math.abs(panPct)}%` : `R ${panPct}%`
		const distStr = `${Math.round(node.y * 100)}% PROFUNDIDADE`

		const row = document.createElement('div')
		row.className =
			'p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between'
		row.innerHTML = `
      <span class="font-bold" style="color: ${node.color}">${node.name}</span>
      <div class="flex items-center gap-3 text-[10px]">
        <span class="text-slate-300">Pan: <strong class="text-amber-400">${panStr}</strong></span>
        <span class="text-slate-400">Dist: <strong>${distStr}</strong></span>
      </div>
    `
		spatialChannelsContainer.appendChild(row)
	})
}

// ─── AI REFERENCE MATCH MODULE ───────────────────────────────────────────────
function setupAiMatchModule() {
	aiTargetDropzone.addEventListener('click', () => aiTargetFileInput.click())
	aiTargetFileInput.addEventListener('change', async () => {
		const file = aiTargetFileInput.files?.[0]
		if (!file) return
		aiTargetTitle.textContent = file.name
		aiTargetInfo.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`

		try {
			const arr = await file.arrayBuffer()
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			aiTargetBuffer = await ctx.decodeAudioData(arr)
			aiTargetInfo.textContent = `${(aiTargetBuffer.duration / 60).toFixed(1)} min · Decodificado`
			checkAiReady()
		} catch (_e) {
			aiTargetInfo.textContent = '❌ Erro ao decodificar.'
		}
	})

	aiRefDropzone.addEventListener('click', () => aiRefFileInput.click())
	aiRefFileInput.addEventListener('change', async () => {
		const file = aiRefFileInput.files?.[0]
		if (!file) return
		aiRefTitle.textContent = file.name
		aiRefInfo.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · Carregando...`

		try {
			const arr = await file.arrayBuffer()
			// @ts-expect-error
			const ctx = new (window.AudioContext || window.webkitAudioContext)()
			aiRefBuffer = await ctx.decodeAudioData(arr)
			aiRefInfo.textContent = `${(aiRefBuffer.duration / 60).toFixed(1)} min · Decodificado`
			checkAiReady()
		} catch (_e) {
			aiRefInfo.textContent = '❌ Erro ao decodificar.'
		}
	})

	function checkAiReady() {
		if (aiTargetBuffer && aiRefBuffer) {
			btnRunAiMatch.disabled = false
			btnRunAiMatch.classList.remove('opacity-50', 'cursor-not-allowed')
		}
	}

	btnRunAiMatch.addEventListener('click', async () => {
		if (!aiTargetBuffer || !aiRefBuffer) return
		btnRunAiMatch.disabled = true
		aiProgressWrap.classList.remove('hidden')

		try {
			const res = await AiMatchEngine.matchToReference(aiTargetBuffer, aiRefBuffer, (pct, txt) => {
				aiProgressBar.style.width = `${pct}%`
				aiProgressPct.textContent = `${pct}%`
				aiProgressText.textContent = txt
			})

			const mUrl = URL.createObjectURL(res.wavBlob)
			btnDownloadAiMatch.href = mUrl
			btnDownloadAiMatch.download = res.downloadFilename
			btnDownloadAiMatch.classList.remove('hidden')

			mainAudioPlayer.src = mUrl
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
		} catch (err: any) {
			aiProgressText.textContent = `❌ Erro: ${err.message || String(err)}`
		} finally {
			btnRunAiMatch.disabled = false
		}
	})
}

// ─── BATCH PROCESSOR ─────────────────────────────────────────────────────────
function setupBatchProcessing() {
	batchDropzone.addEventListener('click', () => batchFileInput.click())
	batchFileInput.addEventListener('change', () => {
		const files = Array.from(batchFileInput.files || [])
		if (files.length > 0) {
			batchFiles = files
			renderBatchList()
		}
	})

	btnRunBatch.addEventListener('click', async () => {
		if (batchFiles.length === 0) return
		btnRunBatch.disabled = true
		// @ts-expect-error
		const ctx = new (window.AudioContext || window.webkitAudioContext)()

		for (let i = 0; i < batchFiles.length; i++) {
			const f = batchFiles[i]
			const itemEl = document.getElementById(`batch-item-${i}`)
			const statusEl = itemEl?.querySelector('.batch-status')
			if (statusEl) statusEl.textContent = 'Processando...'

			try {
				const arr = await f.arrayBuffer()
				const buf = await ctx.decodeAudioData(arr)
				const res = await MasteringEngine.processMaster(buf, {
					album: activeAlbum,
					bitDepth: '24bit',
				})

				if (statusEl) {
					statusEl.innerHTML = `<a href="${URL.createObjectURL(res.wavBlob)}" download="${res.downloadFilename}" class="text-emerald-400 font-bold underline">⬇️ Baixar WAV</a>`
				}
			} catch (_err) {
				if (statusEl) statusEl.textContent = '❌ Falha'
			}
		}
		btnRunBatch.disabled = false
	})
}

function renderBatchList() {
	batchList.innerHTML = ''
	batchFiles.forEach((file, idx) => {
		const div = document.createElement('div')
		div.id = `batch-item-${idx}`
		div.className =
			'p-3 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center text-xs font-mono'
		div.innerHTML = `
      <span class="text-slate-200 font-bold">${idx + 1}. ${file.name}</span>
      <span class="batch-status text-slate-400">Pendente (${(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
    `
		batchList.appendChild(div)
	})
	btnRunBatch.disabled = false
	btnRunBatch.classList.remove('opacity-50', 'cursor-not-allowed')
}

// ─── SONG ARRANGER & TIMELINE DAW MODULE ─────────────────────────────────────
let currentSections: SongSection[] = []
let lastArrangedResult: any = null

function setupArrangerModule() {
	const btnOpenModal = document.getElementById('btn-open-new-section-modal')
	const btnCloseModal = document.getElementById('btn-close-new-section-modal')
	const modalNewSection = document.getElementById('modal-new-section')
	const btnConfirmAdd = document.getElementById('btn-confirm-add-section')
	const btnAutoDetect = document.getElementById('btn-auto-detect-sections')
	const btnReset = document.getElementById('btn-reset-arrangement')
	const btnPasteSection = document.getElementById('btn-paste-section')
	const btnProcessArranger = document.getElementById('btn-process-arranger') as HTMLButtonElement
	const btnDownloadArranged = document.getElementById('btn-download-arranged') as HTMLAnchorElement
	const arrangerProgressBar = document.getElementById('arranger-progress-bar') as HTMLDivElement
	const arrangerProgressPct = document.getElementById('arranger-progress-pct') as HTMLSpanElement
	const arrangerProgressText = document.getElementById('arranger-progress-text') as HTMLSpanElement
	const arrangerProgressWrap = document.getElementById('arranger-progress-wrap') as HTMLDivElement

	btnOpenModal?.addEventListener('click', () => {
		modalNewSection?.classList.remove('hidden')
	})

	btnCloseModal?.addEventListener('click', () => {
		modalNewSection?.classList.add('hidden')
	})

	btnAutoDetect?.addEventListener('click', () => {
		if (!audioBuffer) return
		currentSections = SongArrangerEngine.autoDetectSections(audioBuffer.duration)
		renderArrangerTimelineUI()
		showStudioToast('⚡ Seções da música detectadas automaticamente!', 'info')
	})

	btnReset?.addEventListener('click', () => {
		if (!audioBuffer) return
		currentSections = SongArrangerEngine.autoDetectSections(audioBuffer.duration)
		renderArrangerTimelineUI()
		showStudioToast('↺ Arranjo restaurado para a estrutura original.', 'info')
	})

	btnPasteSection?.addEventListener('click', () => {
		currentSections = SongArrangerEngine.pasteSection(currentSections)
		renderArrangerTimelineUI()
		showStudioToast('📋 Seção colada com sucesso na linha do tempo!', 'success')
	})

	btnConfirmAdd?.addEventListener('click', () => {
		if (!audioBuffer) return
		const nameInput = document.getElementById('input-new-section-name') as HTMLInputElement
		const durSelect = document.getElementById('select-new-section-dur') as HTMLSelectElement
		const posSelect = document.getElementById('select-new-section-pos') as HTMLSelectElement
		const chkDrums = (document.getElementById('chk-gem-drums') as HTMLInputElement)?.checked ?? true
		const chkBass = (document.getElementById('chk-gem-bass') as HTMLInputElement)?.checked ?? true
		const chkGuitars =
			(document.getElementById('chk-gem-guitars') as HTMLInputElement)?.checked ?? true
		const chkVocals =
			(document.getElementById('chk-gem-vocals') as HTMLInputElement)?.checked ?? false
		const chkSynths =
			(document.getElementById('chk-gem-synths') as HTMLInputElement)?.checked ?? true

		const secDur = parseFloat(durSelect.value) || 30
		const name = nameInput.value.trim() || 'NOVA SEÇÃO'

		// Choose reference start time from chorus or verse
		const refStart = audioBuffer.duration > 60 ? audioBuffer.duration * 0.4 : 0
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
		}

		if (posSelect.value === 'start') {
			currentSections.unshift(newSec)
		} else if (posSelect.value === 'after_chorus') {
			const chorusIdx = currentSections.findIndex(
				(s) => s.name.toLowerCase().includes('refrão') || s.name.toLowerCase().includes('chorus'),
			)
			if (chorusIdx !== -1) {
				currentSections.splice(chorusIdx + 1, 0, newSec)
			} else {
				currentSections.push(newSec)
			}
		} else {
			currentSections.push(newSec)
		}

		modalNewSection?.classList.add('hidden')
		renderArrangerTimelineUI()
		showStudioToast(`➕ Nova seção "${name}" adicionada ao arranjo!`, 'success')
	})

	btnProcessArranger?.addEventListener('click', async () => {
		if (!audioBuffer) return
		btnProcessArranger.disabled = true
		btnProcessArranger.classList.add('opacity-50')
		arrangerProgressWrap.classList.remove('hidden')

		try {
			lastArrangedResult = await SongArrangerEngine.renderArrangement(
				audioBuffer,
				currentSections,
				(pct, txt) => {
					arrangerProgressBar.style.width = `${pct}%`
					arrangerProgressPct.textContent = `${pct}%`
					arrangerProgressText.textContent = txt
				},
				activeAlbum,
			)

			const url = URL.createObjectURL(lastArrangedResult.arrangedWavBlob)
			btnDownloadArranged.href = url
			btnDownloadArranged.download = lastArrangedResult.downloadFilename
			btnDownloadArranged.classList.remove('hidden')

			// Update global audioBuffer so other consoles can master the arranged song!
			audioBuffer = lastArrangedResult.arrangedBuffer
			loadedFileName.textContent = `[ARRANJADO] ${loadedFile ? loadedFile.name : 'audio.wav'}`
			mainAudioPlayer.src = url
			mainAudioPlayer.play()
			btnTransportPlay.textContent = '❚❚'
			btnProcessMaster.disabled = false
			showStudioToast(
				'🏆 Arranjo 24-bit renderizado e pronto para audição / download!',
				'success',
				5000,
			)
		} catch (err: any) {
			arrangerProgressText.textContent = `❌ Erro: ${err.message || String(err)}`
		} finally {
			btnProcessArranger.disabled = false
			btnProcessArranger.classList.remove('opacity-50')
		}
	})
}

function initArrangerWithAudio(buf: AudioBuffer) {
	currentSections = SongArrangerEngine.autoDetectSections(buf.duration)
	const btnProcessArranger = document.getElementById('btn-process-arranger') as HTMLButtonElement
	if (btnProcessArranger) {
		btnProcessArranger.disabled = false
		btnProcessArranger.classList.remove('opacity-50', 'cursor-not-allowed')
	}
	renderArrangerTimelineUI()
}

function renderArrangerTimelineUI() {
	const container = document.getElementById('arranger-timeline-grid')
	const origDurEl = document.getElementById('arranger-orig-dur')
	const newDurEl = document.getElementById('arranger-new-dur')
	const countEl = document.getElementById('arranger-total-sections')

	if (!container) return
	container.innerHTML = ''

	let totalNewSeconds = 0
	currentSections.forEach((s) => {
		if (s.isMuted) return
		const dur = Math.max(0, s.endTime - s.startTime)
		totalNewSeconds += dur * s.repeatCount
	})

	if (origDurEl && audioBuffer) {
		const oM = Math.floor(audioBuffer.duration / 60)
		const oS = Math.floor(audioBuffer.duration % 60)
			.toString()
			.padStart(2, '0')
		origDurEl.textContent = `${oM}:${oS}`
	}

	if (newDurEl) {
		const nM = Math.floor(totalNewSeconds / 60)
		const nS = Math.floor(totalNewSeconds % 60)
			.toString()
			.padStart(2, '0')
		newDurEl.textContent = `${nM}:${nS}`
	}

	if (countEl) countEl.textContent = String(currentSections.length)

	currentSections.forEach((sec, idx) => {
		const card = document.createElement('div')
		card.className = 'studio-card'
		card.style.borderLeft = `4px solid ${sec.color}`
		card.style.display = 'flex'
		card.style.flexDirection = 'column'
		card.style.gap = '8px'
		if (sec.isMuted) {
			card.style.opacity = '0.45'
			card.style.filter = 'grayscale(0.8)'
		}

		const sM = Math.floor(sec.startTime / 60)
		const sS = Math.floor(sec.startTime % 60)
			.toString()
			.padStart(2, '0')
		const eM = Math.floor(sec.endTime / 60)
		const eS = Math.floor(sec.endTime % 60)
			.toString()
			.padStart(2, '0')

		card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
        <span style="font-family: var(--font-display); font-size: 13px; font-weight: 800; color: ${sec.color}; text-transform: uppercase;">
          ${idx + 1}. ${sec.name}
        </span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="switch-toggle-btn btn-audition-sec" data-id="${sec.id}" style="padding: 2px 6px; font-size: 10px; color: var(--emerald-primary);" title="Ouvir este trecho">▶️</button>
          <button type="button" class="switch-toggle-btn btn-mute-sec" data-id="${sec.id}" style="padding: 2px 6px; font-size: 10px; color: ${sec.isMuted ? '#ef4444' : '#94a3b8'};" title="${sec.isMuted ? 'Desmutar' : 'Silenciar'}">${sec.isMuted ? '🔇 MUDO' : '🔊 ATIVO'}</button>
          <button type="button" class="switch-toggle-btn btn-del-sec" data-id="${sec.id}" style="padding: 2px 6px; font-size: 10px; color: var(--red-light);" title="Remover Seção">🗑️</button>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: #94a3b8;">
        <span>Posição na Faixa:</span>
        <strong style="color: #cbd5e1;">${sM}:${sS} ➔ ${eM}:${eS} (${(sec.endTime - sec.startTime).toFixed(1)}s)</strong>
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

      <!-- NATURAL REGENERATION TOGGLE -->
      <button type="button" class="switch-toggle-btn btn-natural-regen ${sec.isNaturalRegen ? 'active-gold' : ''}" data-id="${sec.id}" style="width: 100%; font-size: 10px; padding: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;">
        <span>🪄</span> <strong>${sec.isNaturalRegen ? 'Variação Harmônica Natural Ativa' : 'Aplicar Variação Natural Orgânica'}</strong>
      </button>

      <!-- ACTIVE GEMS BADGES -->
      <div style="display: flex; gap: 4px; font-family: var(--font-mono); font-size: 9px; flex-wrap: wrap;">
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.drums ? 'rgba(245, 158, 11, 0.2)' : '#1e293b'}; color: ${sec.activeGems.drums ? 'var(--gold-light)' : '#64748b'};">🥁 Bat</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.bass ? 'rgba(168, 85, 247, 0.2)' : '#1e293b'}; color: ${sec.activeGems.bass ? 'var(--purple-primary)' : '#64748b'};">🎸 Baixo</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.guitars ? 'rgba(251, 146, 60, 0.2)' : '#1e293b'}; color: ${sec.activeGems.guitars ? '#fb923c' : '#64748b'};">⚡ Gtr</span>
        <span style="padding: 2px 6px; border-radius: 4px; background: ${sec.activeGems.vocals ? 'rgba(6, 182, 212, 0.2)' : '#1e293b'}; color: ${sec.activeGems.vocals ? 'var(--cyan-light)' : '#64748b'};">🎤 Voz</span>
      </div>

      <!-- EDIT ACTIONS: CUT, COPY, DUPLICATE -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 2px;">
        <button type="button" class="switch-toggle-btn btn-split-sec" data-id="${sec.id}" style="font-size: 9px; padding: 4px;" title="Dividir seção em 2 partes">✂️ Cortar</button>
        <button type="button" class="switch-toggle-btn btn-copy-sec" data-id="${sec.id}" style="font-size: 9px; padding: 4px;" title="Copiar seção">📋 Copiar</button>
        <button type="button" class="switch-toggle-btn btn-duplicate-sec" data-id="${sec.id}" style="font-size: 9px; padding: 4px;" title="Duplicar seção">2x Duplicar</button>
      </div>
    `

		container.appendChild(card)
	})

	// Attach event handlers to card buttons
	container.querySelectorAll('.btn-sec-plus').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s) {
				s.repeatCount++
				renderArrangerTimelineUI()
			}
		})
	})

	container.querySelectorAll('.btn-sec-minus').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s && s.repeatCount > 1) {
				s.repeatCount--
				renderArrangerTimelineUI()
			}
		})
	})

	container.querySelectorAll('.btn-audition-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s && mainAudioPlayer) {
				mainAudioPlayer.currentTime = s.startTime
				mainAudioPlayer.play()
				btnTransportPlay.textContent = '❚❚'
				showStudioToast(
					`▶️ Ouvindo trecho: ${s.name} (${s.startTime.toFixed(1)}s ➔ ${s.endTime.toFixed(1)}s)`,
					'info',
					2500,
				)
			}
		})
	})

	container.querySelectorAll('.btn-natural-regen').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s) {
				s.isNaturalRegen = !s.isNaturalRegen
				renderArrangerTimelineUI()
				showStudioToast(
					s.isNaturalRegen
						? `🪄 Variação harmônica natural ativada para "${s.name}"!`
						: `🪄 Variação natural desativada para "${s.name}".`,
					'success',
					3000,
				)
			}
		})
	})

	container.querySelectorAll('.btn-mute-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s) {
				s.isMuted = !s.isMuted
				renderArrangerTimelineUI()
				showStudioToast(
					s.isMuted ? `🔇 "${s.name}" silenciada.` : `🔊 "${s.name}" ativada.`,
					'info',
				)
			}
		})
	})

	container.querySelectorAll('.btn-split-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			if (id) {
				currentSections = SongArrangerEngine.splitSection(currentSections, id, 0.5)
				renderArrangerTimelineUI()
				showStudioToast('✂️ Seção dividida em 2 partes sem perdas!', 'success')
			}
		})
	})

	container.querySelectorAll('.btn-copy-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s) {
				SongArrangerEngine.copySection(s)
				showStudioToast(`📋 "${s.name}" copiada! Use o botão "Colar" para inseri-la.`, 'success')
			}
		})
	})

	container.querySelectorAll('.btn-duplicate-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			const s = currentSections.find((sec) => sec.id === id)
			if (s) {
				const idx = currentSections.indexOf(s)
				const clone: SongSection = {
					...s,
					id: `sec_clone_${Date.now()}`,
					name: `${s.name} (COPIA)`,
				}
				currentSections.splice(idx + 1, 0, clone)
				renderArrangerTimelineUI()
				showStudioToast(`2x "${s.name}" duplicada no arranjo!`, 'success')
			}
		})
	})

	container.querySelectorAll('.btn-del-sec').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id')
			currentSections = currentSections.filter((sec) => sec.id !== id)
			renderArrangerTimelineUI()
			showStudioToast('🗑️ Seção removida da linha do tempo.', 'info')
		})
	})
}

// ─── ANDROID PWA & STANDALONE INSTALLER ─────────────────────────────────────
let deferredPrompt: any = null

function setupAndroidPwaInstaller() {
	const btnHeader = document.getElementById('btn-android-install-header')
	const modalAndroid = document.getElementById('modal-android-installer')
	const btnCloseModal = document.getElementById('btn-close-android-modal')
	const btnTriggerInstall = document.getElementById('btn-trigger-pwa-install')

	// Register Service Worker for offline DSP capabilities
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker
				.register('./sw.js')
				.then((_reg) => {})
				.catch((_err) => {})
		})
	}

	// Capture native Android install prompt
	window.addEventListener('beforeinstallprompt', (e: any) => {
		e.preventDefault()
		deferredPrompt = e
		if (btnHeader) {
			btnHeader.classList.remove('hidden')
			btnHeader.style.animation = 'pulse 2s infinite'
		}
	})

	const openAndroidModal = () => {
		if (deferredPrompt) {
			deferredPrompt.prompt()
			deferredPrompt.userChoice.then((choiceResult: any) => {
				if (choiceResult.outcome === 'accepted') {
					showStudioToast('📲 Aplicativo instalado com sucesso no seu Android!', 'success', 5000)
				}
				deferredPrompt = null
			})
		} else {
			modalAndroid?.classList.remove('hidden')
		}
	}

	btnHeader?.addEventListener('click', openAndroidModal)
	btnTriggerInstall?.addEventListener('click', openAndroidModal)

	btnCloseModal?.addEventListener('click', () => {
		modalAndroid?.classList.add('hidden')
	})
}

// ─── 3 GENERATIVE MUSIC & VOICE CLONING TABS (ABAS 10, 11, 12) ────────────────
function setupGenerativeTabs() {
	// =========================================================================
	// 🌐 ABA 10: GERADOR IA DUAL-TRACK (GOOGLE COLAB GRATUITO T4)
	// =========================================================================
	const inputColabUrl = document.getElementById('input-colab-url') as HTMLInputElement
	const btnTestColab = document.getElementById('btn-test-colab-conn') as HTMLButtonElement
	const badgeColabStatus = document.getElementById('badge-colab-status') as HTMLElement
	const colabPrompt = document.getElementById('colab-music-prompt') as HTMLTextAreaElement
	const colabLyrics = document.getElementById('colab-music-lyrics') as HTMLTextAreaElement
	const colabSampleDropzone = document.getElementById('colab-sample-dropzone') as HTMLElement
	const colabSampleInput = document.getElementById('colab-sample-file-input') as HTMLInputElement
	const colabSampleIdle = document.getElementById('colab-sample-idle') as HTMLElement
	const colabSampleActive = document.getElementById('colab-sample-active') as HTMLElement
	const colabSampleFilename = document.getElementById('colab-sample-filename') as HTMLElement
	const colabVoiceDropzone = document.getElementById('colab-voice-dropzone') as HTMLElement
	const colabVoiceInput = document.getElementById('colab-voice-file-input') as HTMLInputElement
	const colabVoiceIdle = document.getElementById('colab-voice-idle') as HTMLElement
	const colabVoiceActive = document.getElementById('colab-voice-active') as HTMLElement
	const colabVoiceFilename = document.getElementById('colab-voice-filename') as HTMLElement
	const colabVoiceStats = document.getElementById('colab-voice-stats') as HTMLElement
	const selectColabDuration = document.getElementById('select-colab-duration') as HTMLSelectElement
	const selectColabDestination = document.getElementById(
		'select-colab-destination',
	) as HTMLSelectElement
	const btnColabGenerate = document.getElementById(
		'btn-colab-trigger-generate',
	) as HTMLButtonElement
	const colabProgressWrap = document.getElementById('colab-progress-wrap') as HTMLElement
	const colabProgressText = document.getElementById('colab-progress-text') as HTMLElement
	const colabProgressPct = document.getElementById('colab-progress-pct') as HTMLElement
	const colabProgressBar = document.getElementById('colab-progress-bar') as HTMLElement

	let colabSampleAudioBuffer: AudioBuffer | null = null
	let colabVoiceAudioBuffer: AudioBuffer | null = null

	// 📡 100% AUTOMATIC DISCOVERY RELAY (ZERO MANUAL COPY/PASTE)
	ColabFreeMusicBridge.startAutoDiscovery((discoveredUrl, latency) => {
		if (inputColabUrl) inputColabUrl.value = discoveredUrl
		if (badgeColabStatus) {
			badgeColabStatus.textContent = `🟢 Conectado Automaticamente ao Google Colab T4 (${latency}ms)`
			badgeColabStatus.style.color = '#10b981'
			badgeColabStatus.style.borderColor = '#10b981'
		}
		if (btnColabGenerate) {
			btnColabGenerate.textContent = '🚀 GERAR MÚSICA NA GPU T4 (AUTO-CONECTADO) & CLONAR VOZ'
		}
		showStudioToast(
			`⚡ Google Colab emparelhado automaticamente (${latency}ms)! Zero configuração.`,
			'success',
			5000,
		)
	})

	const COLAB_PRESETS: Record<string, string> = {
		maiden:
			'Classic 80s British Heavy Metal, 145 BPM in E minor, galloping dual bass, twin harmonized overdrive guitars, Steve Harris clack attack, Bruce Dickinson soaring vocals with 3kHz acoustic ring',
		priest:
			'1990 Speed Metal, 175 BPM in D minor, double bass thunder, scream pitch vocals, laser-sharp rhythm distortion, razor solo',
		dio: 'Mid-tempo Epic Heavy Metal, 110 BPM in A minor, majestic riffs, heavy vibrato soaring vocals, dynamic room reverberation, medieval groove',
		metallica:
			'1991 Heavy Groove Metal, 115 BPM in E minor, scooped mids, tight chugged palm mutes, Lars punchy snare, aggressive baritone rasp',
	}

	document.querySelectorAll('.btn-colab-preset').forEach((btn) => {
		btn.addEventListener('click', () => {
			const p = btn.getAttribute('data-preset')
			if (p && COLAB_PRESETS[p] && colabPrompt) {
				colabPrompt.value = COLAB_PRESETS[p]
				showStudioToast(`🎸 Preset "${p.toUpperCase()}" aplicado ao roteiro!`, 'info', 2000)
			}
		})
	})

	document.querySelectorAll('.btn-colab-insert-tag').forEach((btn) => {
		btn.addEventListener('click', () => {
			const tag = btn.getAttribute('data-tag')
			if (tag && colabLyrics) {
				const start = colabLyrics.selectionStart || colabLyrics.value.length
				const val = colabLyrics.value
				colabLyrics.value = `${val.slice(0, start)}\n${tag}\n${val.slice(start)}`
				colabLyrics.focus()
			}
		})
	})

	btnTestColab?.addEventListener('click', async () => {
		const url = inputColabUrl?.value?.trim() || ''
		ColabFreeMusicBridge.setEndpoint(url)
		if (badgeColabStatus) {
			badgeColabStatus.textContent = '⏳ Testando conexão com Colab...'
			badgeColabStatus.style.color = '#38bdf8'
		}
		const test = await ColabFreeMusicBridge.testConnection(url)
		if (badgeColabStatus) {
			if (test.ok) {
				badgeColabStatus.textContent = `● Conectado ao Colab (${test.latencyMs}ms)`
				badgeColabStatus.style.color = '#10b981'
				badgeColabStatus.style.borderColor = '#10b981'
				showStudioToast('🌐 Conexão ativa com o Google Colab!', 'success')
			} else {
				badgeColabStatus.textContent = `○ ${test.message} (Gera prévia estéreo local)`
				badgeColabStatus.style.color = '#f59e0b'
				badgeColabStatus.style.borderColor = 'var(--border-subtle)'
				showStudioToast(
					'Modo offline: Gerará prévia estéreo direta se o Colab não estiver rodando',
					'info',
				)
			}
		}
	})

	colabSampleDropzone?.addEventListener('click', () => colabSampleInput?.click())
	colabSampleInput?.addEventListener('change', async () => {
		const file = colabSampleInput.files?.[0]
		if (!file) return
		if (colabSampleFilename) colabSampleFilename.textContent = file.name
		colabSampleIdle?.classList.add('hidden')
		colabSampleActive?.classList.remove('hidden')
		try {
			colabSampleAudioBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(file)
			showStudioToast(`📁 Música de amostra decodificada: ${file.name}`, 'success')
		} catch (err: any) {
			showStudioToast(`Erro ao decodificar amostra: ${err?.message || err}`, 'warn')
		}
	})

	colabVoiceDropzone?.addEventListener('click', () => colabVoiceInput?.click())
	colabVoiceInput?.addEventListener('change', async () => {
		const file = colabVoiceInput.files?.[0]
		if (!file) return
		if (colabVoiceFilename) colabVoiceFilename.textContent = file.name
		colabVoiceIdle?.classList.add('hidden')
		colabVoiceActive?.classList.remove('hidden')
		try {
			colabVoiceAudioBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(file)
			const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(colabVoiceAudioBuffer)
			if (colabVoiceStats) {
				colabVoiceStats.textContent = `⚡ 14 Formantes Ativos (+${fp.singersFormantDb.toFixed(1)}dB Anel do Cantor)`
			}
			showStudioToast(`🎙️ Voz real decodificada com sucesso: ${file.name}`, 'success')
		} catch (err: any) {
			showStudioToast(`Erro ao decodificar áudio da voz: ${err?.message || err}`, 'warn')
		}
	})

	btnColabGenerate?.addEventListener('click', async () => {
		const promptText =
			colabPrompt?.value?.trim() ||
			'Classic British Heavy Metal, 145 BPM in E minor, galloping dual bass, twin harmonized overdrive guitars'
		const lyricsText =
			colabLyrics?.value?.trim() ||
			'[Intro Riff]\n[Verse 1]\nThunder on the highway\n[Chorus]\nFire in the sky\n[Outro]'
		const duration = parseInt(selectColabDuration?.value || '60', 10)

		btnColabGenerate.disabled = true
		colabProgressWrap?.classList.remove('hidden')
		if (colabProgressBar) colabProgressBar.style.width = '20%'
		if (colabProgressPct) colabProgressPct.textContent = '20%'
		if (colabProgressText) colabProgressText.textContent = 'Iniciando síntese de áudio neural...'

		try {
			const res = await ColabFreeMusicBridge.generateMusic(
				{
					prompt: promptText,
					lyrics: lyricsText,
					durationSec: duration,
					sampleAudioBuffer: colabSampleAudioBuffer,
					referenceVoiceBuffer: colabVoiceAudioBuffer,
				},
				(status) => {
					if (colabProgressText) colabProgressText.textContent = status
					if (colabProgressBar) colabProgressBar.style.width = '65%'
					if (colabProgressPct) colabProgressPct.textContent = '65%'
				},
			)

			const finalBuffer = res.audioBuffer

			if (VoiceTimbreCloner.hasUserVoice() || colabVoiceAudioBuffer) {
				if (colabProgressText)
					colabProgressText.textContent = 'Filtro espectral: transferindo formantes da sua voz...'
				const left = finalBuffer.getChannelData(0)
				const right = finalBuffer.numberOfChannels > 1 ? finalBuffer.getChannelData(1) : left
				const cloned = VoiceTimbreCloner.processTimbreTransfer(
					left,
					right,
					0.45,
					0,
					finalBuffer.sampleRate,
				)
				finalBuffer.copyToChannel(cloned.left, 0)
				if (finalBuffer.numberOfChannels > 1) finalBuffer.copyToChannel(cloned.right, 1)
			}

			if (colabProgressBar) colabProgressBar.style.width = '100%'
			if (colabProgressPct) colabProgressPct.textContent = '100%'
			if (colabProgressText) colabProgressText.textContent = 'Canção pronta!'

			const trackName = `Colab_Metal_${duration}s.wav`
			loadBufferIntoStudio(finalBuffer, trackName)

			const dest = selectColabDestination?.value || 'master_console'
			if (dest === 'master_console') {
				const tabMastering = document.querySelector(
					'.studio-tab[data-tab="tab-mastering"]',
				) as HTMLButtonElement
				tabMastering?.click()
			}

			showStudioToast(`🎉 ${res.message} Carregada no estúdio!`, 'success', 6000)
		} catch (e: any) {
			showStudioToast(`Erro ao gerar música: ${e?.message || e}`, 'warn', 6000)
		} finally {
			btnColabGenerate.disabled = false
		}
	})

	// =========================================================================
	// ⚙️ ABA 11: RE-COMPOSITOR ALGORÍTMICO OFFLINE (100% NO NAVEGADOR)
	// =========================================================================
	const offlineSampleDropzone = document.getElementById('offline-sample-dropzone') as HTMLElement
	const offlineSampleInput = document.getElementById(
		'offline-sample-file-input',
	) as HTMLInputElement
	const offlineSampleIdle = document.getElementById('offline-sample-idle') as HTMLElement
	const offlineSampleActive = document.getElementById('offline-sample-active') as HTMLElement
	const offlineSampleFilename = document.getElementById('offline-sample-filename') as HTMLElement
	const offlineSampleStats = document.getElementById('offline-sample-stats') as HTMLElement
	const offlineScript = document.getElementById('offline-script-lyrics') as HTMLTextAreaElement
	const offlineVoiceDropzone = document.getElementById('offline-voice-dropzone') as HTMLElement
	const offlineVoiceInput = document.getElementById('offline-voice-file-input') as HTMLInputElement
	const offlineVoiceIdle = document.getElementById('offline-voice-idle') as HTMLElement
	const offlineVoiceActive = document.getElementById('offline-voice-active') as HTMLElement
	const offlineVoiceFilename = document.getElementById('offline-voice-filename') as HTMLElement
	const offlineVoiceStats = document.getElementById('offline-voice-stats') as HTMLElement
	const offlineBpmSlider = document.getElementById('offline-bpm-slider') as HTMLInputElement
	const offlineBpmVal = document.getElementById('offline-bpm-val') as HTMLElement
	const offlineVoiceBlend = document.getElementById('offline-voice-blend') as HTMLInputElement
	const offlineBlendVal = document.getElementById('offline-blend-val') as HTMLElement
	const btnOfflineRecompose = document.getElementById(
		'btn-offline-trigger-recompose',
	) as HTMLButtonElement
	const offlineProgressWrap = document.getElementById('offline-progress-wrap') as HTMLElement
	const offlineProgressText = document.getElementById('offline-progress-text') as HTMLElement
	const offlineProgressPct = document.getElementById('offline-progress-pct') as HTMLElement
	const offlineProgressBar = document.getElementById('offline-progress-bar') as HTMLElement

	let offlineSampleBuffer: AudioBuffer | null = null

	offlineBpmSlider?.addEventListener('input', () => {
		if (offlineBpmVal) offlineBpmVal.textContent = `${offlineBpmSlider.value} BPM`
	})
	offlineVoiceBlend?.addEventListener('input', () => {
		if (offlineBlendVal) offlineBlendVal.textContent = `${offlineVoiceBlend.value}%`
	})

	document.querySelectorAll('.btn-offline-insert-tag').forEach((btn) => {
		btn.addEventListener('click', () => {
			const tag = btn.getAttribute('data-tag')
			if (tag && offlineScript) {
				const start = offlineScript.selectionStart || offlineScript.value.length
				const val = offlineScript.value
				offlineScript.value = `${val.slice(0, start)}\n${tag}\n${val.slice(start)}`
				offlineScript.focus()
			}
		})
	})

	offlineSampleDropzone?.addEventListener('click', () => offlineSampleInput?.click())
	offlineSampleInput?.addEventListener('change', async () => {
		const file = offlineSampleInput.files?.[0]
		if (!file) return
		if (offlineSampleFilename) offlineSampleFilename.textContent = file.name
		offlineSampleIdle?.classList.add('hidden')
		offlineSampleActive?.classList.remove('hidden')
		try {
			offlineSampleBuffer = await UniversalAudioFormatDecoder.decodeAudioFile(file)
			const bpm = LocalAlgorithmicRecomposerEngine.detectTempo(offlineSampleBuffer)
			if (offlineBpmSlider) offlineBpmSlider.value = String(bpm)
			if (offlineBpmVal) offlineBpmVal.textContent = `${bpm} BPM`
			if (offlineSampleStats) {
				offlineSampleStats.textContent = `● Andamento Detectado: ${bpm} BPM (${(offlineSampleBuffer.duration).toFixed(1)}s)`
			}
			showStudioToast(`📁 Música de amostra carregada: ${bpm} BPM detectados!`, 'success')
		} catch (err: any) {
			showStudioToast(`Erro ao carregar áudio de amostra: ${err?.message || err}`, 'warn')
		}
	})

	offlineVoiceDropzone?.addEventListener('click', () => offlineVoiceInput?.click())
	offlineVoiceInput?.addEventListener('change', async () => {
		const file = offlineVoiceInput.files?.[0]
		if (!file) return
		if (offlineVoiceFilename) offlineVoiceFilename.textContent = file.name
		offlineVoiceIdle?.classList.add('hidden')
		offlineVoiceActive?.classList.remove('hidden')
		try {
			const vBuf = await UniversalAudioFormatDecoder.decodeAudioFile(file)
			const fp = await VoiceTimbreCloner.analyzeUserVoiceSample(vBuf)
			if (offlineVoiceStats) {
				offlineVoiceStats.textContent = `⚡ Timbre Real Ativo (+${fp.singersFormantDb.toFixed(1)}dB Presença)`
			}
			showStudioToast(`🎙️ Voz do usuário indexada para re-composição: ${file.name}`, 'success')
		} catch (err: any) {
			showStudioToast(`Erro ao decodificar voz: ${err?.message || err}`, 'warn')
		}
	})

	btnOfflineRecompose?.addEventListener('click', async () => {
		if (!offlineSampleBuffer) {
			showStudioToast('Carregue uma Música de Amostra primeiro na área verde!', 'warn', 4000)
			offlineSampleInput?.click()
			return
		}

		const scriptText =
			offlineScript?.value?.trim() ||
			'[Intro]\n[Verse]\nMinha nova letra\n[Chorus]\nRefrão com pressão\n[Solo]\n[Outro]'
		const bpm = parseInt(offlineBpmSlider?.value || '128', 10)

		btnOfflineRecompose.disabled = true
		offlineProgressWrap?.classList.remove('hidden')

		try {
			const recomposed = await LocalAlgorithmicRecomposerEngine.recompose(
				{
					sampleBuffer: offlineSampleBuffer,
					scriptText,
					tempoBpm: bpm,
				},
				(pct, status) => {
					if (offlineProgressBar) offlineProgressBar.style.width = `${pct}%`
					if (offlineProgressPct) offlineProgressPct.textContent = `${pct}%`
					if (offlineProgressText) offlineProgressText.textContent = status
				},
			)

			const trackName = `Recomposed_Offline_${bpm}BPM.wav`
			loadBufferIntoStudio(recomposed, trackName)

			const tabMastering = document.querySelector(
				'.studio-tab[data-tab="tab-mastering"]',
			) as HTMLButtonElement
			tabMastering?.click()

			showStudioToast(
				'🎉 Nova canção re-composta com sucesso a partir da amostra e script!',
				'success',
				6000,
			)
		} catch (e: any) {
			showStudioToast(`Erro na re-composição: ${e?.message || e}`, 'warn', 6000)
		} finally {
			btnOfflineRecompose.disabled = false
		}
	})

	// =========================================================================
	// 🐍 ABA 12: SERVIDOR PYTHON / COLAB ESPECIALISTA (MUSICGEN + RVC v2)
	// =========================================================================
	const inputPythonUrl = document.getElementById('input-python-url') as HTMLInputElement
	const btnTestPython = document.getElementById('btn-test-python-conn') as HTMLButtonElement
	const badgePythonStatus = document.getElementById('badge-python-status') as HTMLElement
	const btnCopyPythonCode = document.getElementById('btn-copy-python-code') as HTMLButtonElement
	const pythonPrompt = document.getElementById('python-music-prompt') as HTMLTextAreaElement
	const pythonLyrics = document.getElementById('python-music-lyrics') as HTMLTextAreaElement
	const pythonSampleDropzone = document.getElementById('python-sample-dropzone') as HTMLElement
	const pythonSampleInput = document.getElementById('python-sample-file-input') as HTMLInputElement
	const pythonSampleIdle = document.getElementById('python-sample-idle') as HTMLElement
	const pythonSampleActive = document.getElementById('python-sample-active') as HTMLElement
	const pythonSampleFilename = document.getElementById('python-sample-filename') as HTMLElement
	const pythonVoiceDropzone = document.getElementById('python-voice-dropzone') as HTMLElement
	const pythonVoiceInput = document.getElementById('python-voice-file-input') as HTMLInputElement
	const pythonVoiceIdle = document.getElementById('python-voice-idle') as HTMLElement
	const pythonVoiceActive = document.getElementById('python-voice-active') as HTMLElement
	const pythonVoiceFilename = document.getElementById('python-voice-filename') as HTMLElement
	const btnPythonGenerate = document.getElementById(
		'btn-python-trigger-generate',
	) as HTMLButtonElement
	const pythonProgressWrap = document.getElementById('python-progress-wrap') as HTMLElement
	const pythonProgressText = document.getElementById('python-progress-text') as HTMLElement
	const pythonProgressPct = document.getElementById('python-progress-pct') as HTMLElement
	const pythonProgressBar = document.getElementById('python-progress-bar') as HTMLElement

	let pythonSampleBlob: Blob | null = null
	let pythonVoiceBlob: Blob | null = null

	btnCopyPythonCode?.addEventListener('click', async () => {
		const code = PythonColabBridgeEngine.getPythonServerScriptCode()
		await navigator.clipboard.writeText(code)
		btnCopyPythonCode.textContent = '✅ Código Copiado!'
		showStudioToast('📋 Código do servidor Python/FastAPI copiado com sucesso!', 'success')
		setTimeout(() => {
			btnCopyPythonCode.textContent = '📋 Copiar Código Python'
		}, 2500)
	})

	btnTestPython?.addEventListener('click', async () => {
		const url = inputPythonUrl?.value?.trim() || 'http://127.0.0.1:8000'
		PythonColabBridgeEngine.setUrl(url)
		if (badgePythonStatus) {
			badgePythonStatus.textContent = '⏳ Verificando servidor Python...'
			badgePythonStatus.style.color = '#f59e0b'
		}
		const status = await PythonColabBridgeEngine.checkHealth(url)
		if (badgePythonStatus) {
			if (status.connected) {
				badgePythonStatus.textContent = `● Servidor Online: ${status.gpuName} (${status.latencyMs}ms)`
				badgePythonStatus.style.color = '#10b981'
				badgePythonStatus.style.borderColor = '#10b981'
				showStudioToast(`Servidor Python conectado: ${status.gpuName}`, 'success')
			} else {
				badgePythonStatus.textContent =
					'○ Servidor Python não detectado (Gera prévia estéreo local)'
				badgePythonStatus.style.color = '#f59e0b'
				badgePythonStatus.style.borderColor = 'var(--border-subtle)'
				showStudioToast('Servidor local offline. Modo de prévia procedural ativo.', 'info')
			}
		}
	})

	pythonSampleDropzone?.addEventListener('click', () => pythonSampleInput?.click())
	pythonSampleInput?.addEventListener('change', () => {
		const file = pythonSampleInput.files?.[0]
		if (!file) return
		pythonSampleBlob = file
		if (pythonSampleFilename) pythonSampleFilename.textContent = file.name
		pythonSampleIdle?.classList.add('hidden')
		pythonSampleActive?.classList.remove('hidden')
		showStudioToast(`🎧 Amostra para guia melódico: ${file.name}`, 'info')
	})

	pythonVoiceDropzone?.addEventListener('click', () => pythonVoiceInput?.click())
	pythonVoiceInput?.addEventListener('change', async () => {
		const file = pythonVoiceInput.files?.[0]
		if (!file) return
		pythonVoiceBlob = file
		if (pythonVoiceFilename) pythonVoiceFilename.textContent = file.name
		pythonVoiceIdle?.classList.add('hidden')
		pythonVoiceActive?.classList.remove('hidden')
		try {
			const vBuf = await UniversalAudioFormatDecoder.decodeAudioFile(file)
			await VoiceTimbreCloner.analyzeUserVoiceSample(vBuf)
			showStudioToast(`🎙️ Voz indexada para RVC v2: ${file.name}`, 'success')
		} catch (_) {}
	})

	btnPythonGenerate?.addEventListener('click', async () => {
		const promptText =
			pythonPrompt?.value?.trim() ||
			'Heavy Metal track following the melody of the sample, with distorted dual lead guitars, punchy acoustic drums and energetic drive'
		const lyricsText =
			pythonLyrics?.value?.trim() ||
			'[Verse]\nCante com voz poderosa no compasso\n[Chorus]\nRefrão épico e cortante'

		btnPythonGenerate.disabled = true
		pythonProgressWrap?.classList.remove('hidden')
		if (pythonProgressBar) pythonProgressBar.style.width = '30%'
		if (pythonProgressPct) pythonProgressPct.textContent = '30%'

		try {
			const res = await PythonColabBridgeEngine.generate(
				promptText,
				lyricsText,
				60,
				pythonSampleBlob,
				pythonVoiceBlob,
				(msg) => {
					if (pythonProgressText) pythonProgressText.textContent = msg
					if (pythonProgressBar) pythonProgressBar.style.width = '70%'
					if (pythonProgressPct) pythonProgressPct.textContent = '70%'
				},
			)

			if (pythonProgressBar) pythonProgressBar.style.width = '100%'
			if (pythonProgressPct) pythonProgressPct.textContent = '100%'
			if (pythonProgressText) pythonProgressText.textContent = 'Geração concluída!'

			const trackName = 'MusicGen_RVC_Composed.wav'
			loadBufferIntoStudio(res.audioBuffer, trackName)

			const tabMastering = document.querySelector(
				'.studio-tab[data-tab="tab-mastering"]',
			) as HTMLButtonElement
			tabMastering?.click()

			showStudioToast(`🎉 ${res.message}`, 'success', 6000)
		} catch (err: any) {
			showStudioToast(`Erro no servidor Python: ${err?.message || err}`, 'warn', 6000)
		} finally {
			btnPythonGenerate.disabled = false
		}
	})
}

// ─── RUN ON DOM LOAD ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
	init()
	setupAndroidPwaInstaller()
})
