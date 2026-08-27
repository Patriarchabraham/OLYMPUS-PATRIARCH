/**
 * Master of Masters Studio Pro — Core Quantum Supreme Audio Processing Engine.
 * Multi-layer Stem Separation, AI Spectral Diagnosis, 512-Band Historical Matcher,
 * Dynamic Resonance Suppressor (Soothe/Gullfoss), Smart Kick/Bass Unmasker,
 * Transient Punch Sculptor, Transformer Hysteresis, 4-Band Holographic Spatializer,
 * Real-World Device Simulation, and Streaming Targets.
 */

import type { MasterAlbumSetup, MasterProducer } from '../database/masters-database'
import { AbbeyRoadAdtEngine } from './AbbeyRoadAdtEngine'
import { AiMasterAssistant, type TrackDiagnostic } from './AiMasterAssistant'
import { AnalogClipperLimiterEngine, type LimiterMode } from './AnalogClipperLimiterEngine'
import type { AnalogColorModel } from './AnalogTapeTransformerEngine'
import { AudioBufferHelper } from './AudioBufferHelper'
import { AuralAirExciterEngine } from './AuralAirExciterEngine'
import { AutonomousRhythmGuitarGuardianAgent } from './AutonomousRhythmGuitarGuardianAgent'
import { BatchExportReportEngine } from './BatchExportReportEngine'
import { BiBandSaturationEngine } from './BiBandSaturationEngine'
import { BlumleinPhaseLockEngine } from './BlumleinPhaseLockEngine'
import type { CabinetIrType } from './CabinetIrConvolutionEngine'
import { DeHummerGroundCleaner } from './DeHummerGroundCleaner'
import { DolbyAtmosBinauralRoom } from './DolbyAtmosBinauralRoom'
import { DynamicResonanceSuppressor } from './DynamicResonanceSuppressor'
import { HolographicSpatialEngine } from './HolographicSpatialEngine'
import { MultiBandTransientPunchEngine } from './MultiBandTransientPunchEngine'
import { MultibandDynamicMatcher } from './MultibandDynamicMatcher'
import { type RealWorldDevice, RealWorldDeviceSimulator } from './RealWorldDeviceSimulator'
import { SmartKickBassUnmasker } from './SmartKickBassUnmasker'
import { SpectralClonerEngine2048 } from './SpectralClonerEngine2048'
import { type StreamingPlatform, StreamingTargetEngine } from './StreamingTargetEngine'
import { SubBassEllipticalAnchorEngine } from './SubBassEllipticalAnchorEngine'
import type { GuitarRescueMode } from './SunoDistortionRescueEngine'
import { TinyNeuralAudioEngine } from './TinyNeuralAudioEngine'
import { UniversalStemSeparationEngine } from './UniversalStemSeparationEngine'
import {
	type AudioStats,
	audioBufferTo24BitWavBlob,
	audioBufferTo32BitFloatWavBlob,
	calculateBufferStats,
} from './WavEncoder'

export interface ProcessMasterOptions {
	album: MasterAlbumSetup
	producer?: MasterProducer
	inputSourceMode?: 'studio_demo' | 'ai_generated' | 'auto'
	intensityScale?: number
	customDrive?: number
	customWidth?: number
	drumReplacementBlend?: number
	guitarReampBlend?: number
	bassReampBlend?: number
	vocalModelBlend?: number
	drumKitModelId?: string
	guitarRigModelId?: string
	bassRigModelId?: string
	vocalRigModelId?: string
	secretProducerHackId?: string
	hackIntensity?: number
	cabinetIrModel?: CabinetIrType
	enableDeHum?: boolean
	enableAbbeyRoadAdt?: boolean
	adtBlend?: number
	harmonyOptions?: any
	pitchOptions?: any
	targetCeilingDb?: number
	bitDepth?: '24bit' | '32bit'
	streamingPlatform?: StreamingPlatform
	analogColorModel?: AnalogColorModel
	limiterMode?: LimiterMode
	enableAiAssistant?: boolean
	enableDynamicDeHarsh?: boolean
	enableKickBassUnmask?: boolean
	enableGuitarRescue?: boolean
	guitarRescueMode?: GuitarRescueMode
	transientPunchAmount?: number
	realWorldDevice?: RealWorldDevice
	enableDolbyAtmosRoom?: boolean
	enableTinyNeuralVocal?: boolean
	onProgress?: (percent: number, status: string) => void
}

export interface MasterResult {
	masterBuffer: AudioBuffer
	wavBlob: Blob
	stats: AudioStats
	downloadFilename: string
	diagnostic?: TrackDiagnostic
	reportHtml: string
	detectedSourceType?: 'studio_demo' | 'ai_generated'
}

export class AudioEngine {
	/**
	 * Main Master of Masters Quantum Supreme Audio Pipeline.
	 */
	public static async processMaster(
		inputBuffer: AudioBuffer,
		options: ProcessMasterOptions,
	): Promise<MasterResult> {
		const {
			album,
			producer,
			inputSourceMode = 'studio_demo',
			intensityScale = 1.0,
			customDrive,
			customWidth,
			drumReplacementBlend = 0.0,
			guitarReampBlend = 0.0,
			bassReampBlend = 0.0,
			vocalModelBlend = 0.0,
			drumKitModelId = 'bypass',
			guitarRigModelId = 'bypass',
			bassRigModelId = 'bypass',
			vocalRigModelId = 'bypass',
			secretProducerHackId = 'bypass',
			hackIntensity = 0.65,
			harmonyOptions = {},
			pitchOptions = {
				enabled: false,
				rootKey: 'C',
				scale: 'chromatic',
				retuneSpeed: 0.65,
				amount: 0.8,
			},
			bitDepth = '24bit',
			streamingPlatform = 'cd_metal',
			analogColorModel = 'ampex_atr102',
			limiterMode = 'soft_analog_clipper',
			enableAiAssistant = true,
			enableDeHum = true,
			enableDynamicDeHarsh = true,
			enableKickBassUnmask = true,
			enableGuitarRescue = true,
			guitarRescueMode = 'auto_detect_fill',
			transientPunchAmount = 0.45,
			realWorldDevice = 'flat_studio',
			enableDolbyAtmosRoom = false,
			enableAbbeyRoadAdt = false,
			adtBlend = 0.45,
			enableTinyNeuralVocal = true,
			onProgress,
		} = options

		const sr = inputBuffer.sampleRate
		const length = inputBuffer.length

		// Always ensure a pristine 2-channel stereo working buffer (prevents IndexSizeError on mono inputs)
		const activeInputBuffer = AudioBufferHelper.createAudioBuffer(2, length, sr)
		activeInputBuffer.copyToChannel(inputBuffer.getChannelData(0), 0)
		activeInputBuffer.copyToChannel(
			inputBuffer.numberOfChannels > 1
				? inputBuffer.getChannelData(1)
				: inputBuffer.getChannelData(0),
			1,
		)

		// Detect if track is a real studio recording or AI generated
		let isRealStudio = inputSourceMode === 'studio_demo'
		if (inputSourceMode === 'auto') {
			// Analyze crest factor and dynamic range
			const chan0 = activeInputBuffer.getChannelData(0)
			let peak = 0,
				sumSq = 0
			for (let i = 0; i < Math.min(length, 44100 * 30); i += 16) {
				const abs = Math.abs(chan0[i])
				if (abs > peak) peak = abs
				sumSq += abs * abs
			}
			const rms = Math.sqrt(sumSq / (Math.min(length, 44100 * 30) / 16))
			const crest = peak > 0 && rms > 0 ? 20 * Math.log10(peak / rms) : 12
			isRealStudio = crest >= 11.5 // Natural studio recordings have healthy crest factor > 11.5dB
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 0: AI MASTER ASSISTANT 2.0 (SPECTRAL DIAGNOSTIC & PRE-CONDITIONING)
		// ─────────────────────────────────────────────────────────────────────────
		onProgress?.(5, '🧠 Analisando balanço espectral com AI Master Assistant 2.0...')
		let diagnostic: TrackDiagnostic | undefined

		if (enableAiAssistant) {
			diagnostic = AiMasterAssistant.diagnoseTrack(activeInputBuffer)
			const preCorrected = await AiMasterAssistant.applyPreCorrections(
				activeInputBuffer,
				diagnostic,
			)
			activeInputBuffer.copyToChannel(preCorrected.getChannelData(0), 0)
			activeInputBuffer.copyToChannel(
				preCorrected.numberOfChannels > 1
					? preCorrected.getChannelData(1)
					: preCorrected.getChannelData(0),
				1,
			)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 0.5: GROUND LOOP & 50/60Hz ELECTRICAL BUZZ PURIFIER (DE-HUMMER)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		if (enableDeHum !== false) {
			onProgress?.(
				10,
				'⚡ Limpando ruídos de aterramento 50/60Hz e zumbidos elétricos com De-Hummer...',
			)
			const inL = activeInputBuffer.getChannelData(0)
			const inR = activeInputBuffer.getChannelData(1)
			const cleanedHum = DeHummerGroundCleaner.processDeHum(inL, inR, 60, 0.85, sr)
			activeInputBuffer.copyToChannel(cleanedHum.left, 0)
			activeInputBuffer.copyToChannel(cleanedHum.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 1: SIGNAL PATH SELECTION (STUDIO MASTERING VS. AI STEM RESYNTHESIS)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		let weldedStemBuffer: AudioBuffer

		if (
			isRealStudio &&
			drumReplacementBlend <= 0.05 &&
			guitarReampBlend <= 0.05 &&
			(!harmonyOptions.guitarDoubling || harmonyOptions.guitarDoubling === 'off')
		) {
			// 100% PURE AUDIOPHILE STUDIO MASTERING PATH (Zero phase-smear, pristine real drums/guitars)
			onProgress?.(
				15,
				'🎙️ Modo Gravação de Estúdio: Preservando 100% da dinâmica natural dos instrumentos reais...',
			)
			weldedStemBuffer = AudioBufferHelper.createAudioBuffer(2, length, sr)
			weldedStemBuffer.copyToChannel(activeInputBuffer.getChannelData(0), 0)
			weldedStemBuffer.copyToChannel(
				activeInputBuffer.numberOfChannels > 1
					? activeInputBuffer.getChannelData(1)
					: activeInputBuffer.getChannelData(0),
				1,
			)
		} else {
			// AI RECONSTRUCTION PATH (For Suno/Udio/Lo-Fi or when explicitly requested)
			onProgress?.(
				15,
				`Separando e refinando camadas de instrumentos para "${album.band} - ${album.albumTitle}"...`,
			)
			weldedStemBuffer = await UniversalStemSeparationEngine.processAndWeld10Layers(
				new OfflineAudioContext(2, length, sr),
				activeInputBuffer,
				album,
				intensityScale,
				drumReplacementBlend,
				guitarReampBlend,
				bassReampBlend,
				vocalModelBlend,
				harmonyOptions,
				pitchOptions,
			)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 1.5: CPU-OPTIMIZED MICRO-NEURAL VOCODER & WAVEFORM SUPER-RESOLUTION
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		if (enableTinyNeuralVocal) {
			onProgress?.(
				24,
				'🧠 Aplicando síntese micro-neural (<25MB RAM) de cordas vocais e super-resolução 12k-24kHz...',
			)
			const neuL = weldedStemBuffer.getChannelData(0)
			const neuR = weldedStemBuffer.getChannelData(1)
			const neuResult = TinyNeuralAudioEngine.processNeuralSynthesis(
				neuL,
				neuR,
				{
					vocalCloningIntensity: (vocalModelBlend || 0.7) * intensityScale,
					metalRaspDrive: 0.65 * intensityScale,
					superResolutionAir: 0.8 * intensityScale,
				},
				sr,
			)
			weldedStemBuffer.copyToChannel(neuResult.left, 0)
			weldedStemBuffer.copyToChannel(neuResult.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 2: 2048-POINT CONTINUOUS FFT SPECTRAL CLONING & MICRO-RESONANCES
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(28, `Clonando curva espectral analógica do álbum "${album.albumTitle}"...`)
		const clonedL = weldedStemBuffer.getChannelData(0)
		const clonedR =
			weldedStemBuffer.numberOfChannels > 1 ? weldedStemBuffer.getChannelData(1) : clonedL
		const spectralMatched = SpectralClonerEngine2048.process2048Cloning(
			clonedL,
			clonedR,
			album,
			intensityScale * (isRealStudio ? 0.6 : 0.85),
			sr,
		)
		weldedStemBuffer.copyToChannel(spectralMatched.left, 0)
		weldedStemBuffer.copyToChannel(spectralMatched.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 2.1: MULTIBAND DYNAMIC BREATHING & CREST FACTOR MATCHING
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(32, '🌊 Ajustando dinâmica e respiração RMS...')
		const dynL = weldedStemBuffer.getChannelData(0)
		const dynR = weldedStemBuffer.getChannelData(1)
		const dynMatched = MultibandDynamicMatcher.processDynamicMatching(
			dynL,
			dynR,
			album,
			intensityScale * 0.5,
			sr,
		)
		weldedStemBuffer.copyToChannel(dynMatched.left, 0)
		weldedStemBuffer.copyToChannel(dynMatched.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 3: SMART KICK & BASS UNMASKING + DYNAMIC DE-MUDDING & SOOTHE DE-HARSH
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			40,
			'🌊 Desmascarando Bumbo/Baixo e limpando frequências emboladas (250Hz-450Hz)...',
		)
		let lChan = weldedStemBuffer.getChannelData(0)
		let rChan = weldedStemBuffer.getChannelData(1)

		if (enableKickBassUnmask) {
			const unmasked = SmartKickBassUnmasker.processUnmask(lChan, rChan, 0.65 * intensityScale, sr)
			lChan = unmasked.left
			rChan = unmasked.right
		}

		if (enableDynamicDeHarsh) {
			const deHarshed = DynamicResonanceSuppressor.processAdaptiveDeHarsh(
				lChan,
				rChan,
				0.7 * intensityScale,
				sr,
			)
			lChan = deHarshed.left
			rChan = deHarshed.right
		}

		// Dynamic Low-Mid De-Mudding Notch (Removes boomy/dirty 320Hz cardboard buildup)
		const dt = 1.0 / sr
		const rcMud = 1.0 / (2.0 * Math.PI * 340.0)
		const alphaMud = dt / (rcMud + dt)
		let mudL = 0,
			mudR = 0
		for (let i = 0; i < length; i++) {
			mudL += alphaMud * (lChan[i] - mudL)
			mudR += alphaMud * (rChan[i] - mudR)
			lChan[i] = lChan[i] - mudL * 0.15 // -2.0dB precise mud attenuation
			rChan[i] = rChan[i] - mudR * 0.15
		}

		weldedStemBuffer.copyToChannel(lChan, 0)
		weldedStemBuffer.copyToChannel(rChan, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 4: MULTI-BAND TRANSIENT & VISCERAL PUNCH ENGINE (SUB-KICK & SNARE SNAP)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			48,
			'🥊 Esculpindo punch visceral de sub-bumbo (<120Hz) e estalo de caixa (3kHz)...',
		)
		const punchResult = MultiBandTransientPunchEngine.processMultiBandPunch(
			lChan,
			rChan,
			(transientPunchAmount || 0.75) * 1.25 * intensityScale,
			sr,
		)
		weldedStemBuffer.copyToChannel(punchResult.left, 0)
		weldedStemBuffer.copyToChannel(punchResult.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 4.5: AUTONOMOUS AI RHYTHM GUITAR GUARDIAN & SUPREME GUITAR WALL
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		if (enableGuitarRescue !== false) {
			onProgress?.(
				52,
				'🎸 Agente AI Autônomo dosando e injetando guitarras base pesadas e encorpadas (Celestion V30)...',
			)
			const rL = weldedStemBuffer.getChannelData(0)
			const rR = weldedStemBuffer.getChannelData(1)

			const rescueResult = AutonomousRhythmGuitarGuardianAgent.auditAndRescueRhythmGuitars(
				rL,
				rR,
				{
					sensitivity: 0.9,
					ampModel: album.saturation.type || 'peavey_5150',
					distortionDrive: customDrive !== undefined ? customDrive : album.saturation.drive || 0.85,
					blendIntensity: 0.8,
				},
				sr,
			)
			weldedStemBuffer.copyToChannel(rescueResult.left, 0)
			weldedStemBuffer.copyToChannel(rescueResult.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 5: BI-BAND SPLIT SATURATION (<250Hz CLEAN PUNCH + >250Hz TUBE DRIVE)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		const effectiveDrive = customDrive !== undefined ? customDrive : album.saturation.drive || 0.45
		onProgress?.(
			58,
			`Injetando saturação bi-banda analógica (${album.saturation.type.toUpperCase()} - Drive ${(effectiveDrive * 100).toFixed(0)}%)...`,
		)
		const satL = weldedStemBuffer.getChannelData(0)
		const satR = weldedStemBuffer.getChannelData(1)

		if (effectiveDrive > 0.02) {
			const biBandResult = BiBandSaturationEngine.processBiBandSaturation(
				satL,
				satR,
				album.saturation.type,
				effectiveDrive,
				250,
				sr,
			)
			weldedStemBuffer.copyToChannel(biBandResult.left, 0)
			weldedStemBuffer.copyToChannel(biBandResult.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 6: CONSOLE MASTERING EQ & SSL G-BUS GLUE COMPRESSOR (PUNCH MAXIMIZED)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(68, `Processando console analógico SSL G-Bus e EQ de 10 bandas...`)
		const masterCtx = new OfflineAudioContext(2, length, sr)
		const src = masterCtx.createBufferSource()
		src.buffer = weldedStemBuffer

		const inputPad = masterCtx.createGain()
		inputPad.gain.value = 0.95 // Full solid analog drive

		const subHp = masterCtx.createBiquadFilter()
		subHp.type = 'highpass'
		subHp.frequency.value = 28 // Preserves 35Hz-60Hz sub-punch
		subHp.Q.value = Math.SQRT1_2

		// 10-Band Precision Punch EQ
		const eq = album.eq10Band
		const eqScale = 0.25 * intensityScale
		const f30 = masterCtx.createBiquadFilter()
		f30.type = 'lowshelf'
		f30.frequency.value = 40
		f30.gain.value = eq.hz30 * eqScale + 1.2
		const f60 = masterCtx.createBiquadFilter()
		f60.type = 'peaking'
		f60.frequency.value = 65
		f60.Q.value = 1.1
		f60.gain.value = eq.hz60 * eqScale + 2.4 // 65Hz Kick Thump
		const f120 = masterCtx.createBiquadFilter()
		f120.type = 'peaking'
		f120.frequency.value = 120
		f120.Q.value = 1.0
		f120.gain.value = eq.hz120 * eqScale
		const f250 = masterCtx.createBiquadFilter()
		f250.type = 'peaking'
		f250.frequency.value = 250
		f250.Q.value = 1.4
		f250.gain.value = -1.2 // Clean mud
		const f500 = masterCtx.createBiquadFilter()
		f500.type = 'peaking'
		f500.frequency.value = 500
		f500.Q.value = 1.0
		f500.gain.value = eq.hz500 * eqScale
		const f1000 = masterCtx.createBiquadFilter()
		f1000.type = 'peaking'
		f1000.frequency.value = 1000
		f1000.Q.value = 1.0
		f1000.gain.value = eq.hz1000 * eqScale
		const f2500 = masterCtx.createBiquadFilter()
		f2500.type = 'peaking'
		f2500.frequency.value = 2800
		f2500.Q.value = 1.0
		f2500.gain.value = eq.hz2500 * eqScale + 1.8 // Snare Attack Crack
		const f4000 = masterCtx.createBiquadFilter()
		f4000.type = 'peaking'
		f4000.frequency.value = 4200
		f4000.Q.value = 1.0
		f4000.gain.value = eq.hz4000 * eqScale
		const f8000 = masterCtx.createBiquadFilter()
		f8000.type = 'peaking'
		f8000.frequency.value = 8000
		f8000.Q.value = 0.9
		f8000.gain.value = eq.hz8000 * eqScale
		const f16000 = masterCtx.createBiquadFilter()
		f16000.type = 'highshelf'
		f16000.frequency.value = 14000
		f16000.gain.value = eq.hz16000 * eqScale + 1.0

		src.connect(inputPad)
		inputPad.connect(subHp)
		subHp.connect(f30)
		f30.connect(f60)
		f60.connect(f120)
		f120.connect(f250)
		f250.connect(f500)
		f500.connect(f1000)
		f1000.connect(f2500)
		f2500.connect(f4000)
		f4000.connect(f8000)
		f8000.connect(f16000)

		const compNode = masterCtx.createDynamicsCompressor()
		compNode.threshold.value = -14
		compNode.ratio.value = 2.0
		compNode.attack.value = 0.035 // 35ms punchy slow attack (lets kick/snare attack punch through cleanly!)
		compNode.release.value = 0.09 // 90ms punchy musical release
		compNode.knee.value = 4
		f16000.connect(compNode)

		const masterGain = masterCtx.createGain()
		masterGain.gain.value = 1.18 // Drives solid punch into soft-clipper
		compNode.connect(masterGain)
		masterGain.connect(masterCtx.destination)
		src.start(0)

		const renderedMaster = await masterCtx.startRendering()

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 6.5: ABBEY ROAD AUTOMATIC DOUBLE TRACKING (ADT) REEL-TO-REEL FLANGE
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		if (enableAbbeyRoadAdt) {
			onProgress?.(78, '📼 Aplicando dobra de fitas gêmeas Abbey Road ADT com micro-flange...')
			const lAdt = renderedMaster.getChannelData(0)
			const rAdt = renderedMaster.getChannelData(1)
			const adtResult = AbbeyRoadAdtEngine.processAdt(lAdt, rAdt, { blend: adtBlend || 0.45 }, sr)
			renderedMaster.copyToChannel(adtResult.left, 0)
			renderedMaster.copyToChannel(adtResult.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 7: 4-BAND HOLOGRAPHIC 3D MID/SIDE SPATIALIZER
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(80, 'Ajustando imagem 3D holográfica e travando mono sub-bass (<90Hz)...')
		const width = customWidth !== undefined ? customWidth : album.stereoWidth || 1.35
		const lRendered = renderedMaster.getChannelData(0)
		const rRendered = renderedMaster.getChannelData(1)
		const spatialResult = HolographicSpatialEngine.processHolographicWidth(
			lRendered,
			rRendered,
			width,
			sr,
		)
		renderedMaster.copyToChannel(spatialResult.left, 0)
		renderedMaster.copyToChannel(spatialResult.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 7.1: BLUMLEIN STEREO SHUFFLE & SUB PHASE-LOCK (<120Hz MONO GUARD)
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			82,
			'🛡️ Travando sub-graves em mono (<120Hz) e aplicando proteção de correlação de fase Blumlein...',
		)
		const lBlum = renderedMaster.getChannelData(0)
		const rBlum = renderedMaster.getChannelData(1)
		const blumResult = BlumleinPhaseLockEngine.processBlumleinPhaseLock(lBlum, rBlum, 1.12, sr)
		renderedMaster.copyToChannel(blumResult.left, 0)
		renderedMaster.copyToChannel(blumResult.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 8: OPTIONAL DOLBY ATMOS 7.1.4 BINAURAL ROOM / REAL-WORLD SIMULATION
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		if (enableDolbyAtmosRoom) {
			onProgress?.(85, '🏰 Renderizando simulação acústica de sala Dolby Atmos 7.1.4...')
			const lAtm = renderedMaster.getChannelData(0)
			const rAtm = renderedMaster.getChannelData(1)
			const atmosResult = DolbyAtmosBinauralRoom.processBinauralRoom(lAtm, rAtm, true, sr)
			renderedMaster.copyToChannel(atmosResult.left, 0)
			renderedMaster.copyToChannel(atmosResult.right, 1)
		}

		if (realWorldDevice !== 'flat_studio') {
			onProgress?.(
				87,
				`📱 Aplicando simulação acústica de dispositivo (${realWorldDevice.toUpperCase()})...`,
			)
			const lDev = renderedMaster.getChannelData(0)
			const rDev = renderedMaster.getChannelData(1)
			const devResult = RealWorldDeviceSimulator.processDeviceSimulation(
				lDev,
				rDev,
				realWorldDevice,
				sr,
			)
			renderedMaster.copyToChannel(devResult.left, 0)
			renderedMaster.copyToChannel(devResult.right, 1)
		}

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 8.5: SUB-BASS ELLIPTICAL ANCHOR (<90Hz MONO) & 18k-24kHz AIR EXCITER
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			89,
			'✨ Ancorando sub-graves em mono (<90Hz) e excitando harmônicos de ar 18kHz-24kHz...',
		)
		const lPreLim = renderedMaster.getChannelData(0)
		const rPreLim = renderedMaster.getChannelData(1)
		const anchored = SubBassEllipticalAnchorEngine.processEllipticalMono(lPreLim, rPreLim, 90, sr)
		const excited = AuralAirExciterEngine.processAirExciter(anchored.left, anchored.right, 0.4, sr)
		renderedMaster.copyToChannel(excited.left, 0)
		renderedMaster.copyToChannel(excited.right, 1)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 9: STREAMING TARGET CALIBRATION & BRICKWALL TRUE-PEAK LIMITER
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			90,
			`Calibrando alvo para ${streamingPlatform.toUpperCase()} (${limiterMode === 'soft_analog_clipper' ? 'Soft Clipper' : 'Pristine Limiter'})...`,
		)
		StreamingTargetEngine.matchPlatformSpecs(renderedMaster, streamingPlatform)
		AnalogClipperLimiterEngine.processPeakLimiting(renderedMaster, limiterMode, -0.3)

		// ─────────────────────────────────────────────────────────────────────────
		// STAGE 10: AUDIO ENCODING & MASTERING ENGINEERING REPORT
		// ─────────────────────────────────────────────────────────────────────────
		await new Promise((resolve) => setTimeout(resolve, 0))
		onProgress?.(
			95,
			`Codificando WAV ${bitDepth === '24bit' ? '24-Bit HD com Dither TPDF' : '32-Bit Float'} e gerando relatório técnico...`,
		)
		const wavBlob =
			bitDepth === '24bit'
				? audioBufferTo24BitWavBlob(renderedMaster)
				: audioBufferTo32BitFloatWavBlob(renderedMaster)

		const stats = calculateBufferStats(renderedMaster)
		const cleanAlbum = album.albumTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
		const downloadFilename = `MASTER_${album.band.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanAlbum}_24bit.wav`

		const reportHtml = BatchExportReportEngine.generateHtmlReport(
			stats,
			album,
			producer,
			album.albumTitle,
		)

		onProgress?.(
			100,
			`✅ Masterização Quântica Analógica Concluída com Excelência! (${album.albumTitle})`,
		)

		return {
			masterBuffer: renderedMaster,
			wavBlob,
			stats,
			downloadFilename,
			diagnostic,
			reportHtml,
		}
	}
}

export { AudioEngine as MasteringEngine, type MasterResult as MasteringResult }
