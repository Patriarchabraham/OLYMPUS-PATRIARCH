import type { MasterAlbumSetup } from '../database/masters-database'
import {
	type BassistSignature,
	type DrummerSignature,
	FAMOUS_BASSISTS,
	FAMOUS_DRUMMERS,
} from '../database/musicians-database'
import { generateSaturationCurve, type SaturationType } from './SaturationCurves'
import {
	type AudioStats,
	audioBufferTo24BitWavBlob,
	calculateBufferStats,
	normalizeBufferToCeiling,
} from './WavEncoder'

export interface ProcessedGemTrack {
	gemName: 'drums' | 'bass' | 'guitars' | 'vocals' | 'synthsFx'
	buffer: AudioBuffer
	blob: Blob
	stats: AudioStats
}

export interface GemFaderConfig {
	volumeDb: number // -12dB to +6dB
	pan: number // -1.0 to +1.0
	toneDb: number // -6dB to +6dB Tilt
	mute: boolean
	solo: boolean
}

export interface WelderOptions {
	customGuitarDistortion?: SaturationType | 'album_default'
	customGuitarDrive?: number
	customBassSaturation?: SaturationType | 'album_default'
	customBassDrive?: number
	customDrumSaturation?: SaturationType | 'album_default'
	customDrumDrive?: number
	bassistPresetId?: string
	drummerPresetId?: string
	gemFaders?: Record<string, GemFaderConfig>
	onProgress?: (pct: number, txt: string) => void
}

export interface WelderResult {
	individualGems: ProcessedGemTrack[]
	weldedBuffer: AudioBuffer
	weldedWavBlob: Blob
	stats: AudioStats
	downloadFilename: string
}

export class GemWelderEngine {
	/**
	 * Processes all 5 Multitrack Gems independently with their specialized hardware chains,
	 * supports famous bassist and drummer signatures, live fader mixing, and performs Master Summing Welding.
	 */
	public static async processGemsAndWeld(
		inputBuffer: AudioBuffer,
		album: MasterAlbumSetup,
		optionsOrProgress?: WelderOptions | ((pct: number, txt: string) => void),
	): Promise<WelderResult> {
		let options: WelderOptions = {}
		if (typeof optionsOrProgress === 'function') {
			options = { onProgress: optionsOrProgress }
		} else if (optionsOrProgress) {
			options = optionsOrProgress
		}

		const {
			customGuitarDistortion,
			customGuitarDrive,
			customBassSaturation,
			customBassDrive,
			customDrumSaturation,
			customDrumDrive,
			bassistPresetId,
			drummerPresetId,
			gemFaders = {},
			onProgress,
		} = options

		const bassistProfile: BassistSignature | undefined = bassistPresetId
			? FAMOUS_BASSISTS.find((b) => b.id === bassistPresetId)
			: undefined

		const drummerProfile: DrummerSignature | undefined = drummerPresetId
			? FAMOUS_DRUMMERS.find((d) => d.id === drummerPresetId)
			: undefined

		const gemsList: ('drums' | 'bass' | 'guitars' | 'vocals' | 'synthsFx')[] = [
			'drums',
			'bass',
			'guitars',
			'vocals',
			'synthsFx',
		]

		const individualGems: ProcessedGemTrack[] = []
		const dur = inputBuffer.duration
		const sr = inputBuffer.sampleRate

		// Check if any gem is soloed
		const hasSolo = Object.values(gemFaders).some((f) => f.solo)

		for (let gIdx = 0; gIdx < gemsList.length; gIdx++) {
			const gemKey = gemsList[gIdx]
			const gemConf = album.gemSetup[gemKey]
			const fader = gemFaders[gemKey] || {
				volumeDb: 0,
				pan: 0,
				toneDb: 0,
				mute: false,
				solo: false,
			}

			onProgress?.(
				Math.floor(10 + (gIdx / gemsList.length) * 55),
				`Processando Gem ${gIdx + 1}/5: ${gemKey.toUpperCase()} com hardware dedicado...`,
			)

			const offlineCtx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr)
			const srcNode = offlineCtx.createBufferSource()
			srcNode.buffer = inputBuffer

			// Bandpass / Crossover filtering to isolate the Gem
			const bpFilter = offlineCtx.createBiquadFilter()
			const extraFilters: BiquadFilterNode[] = []
			let activeSatType: SaturationType = gemConf.saturation
			let activeDrive: number = gemConf.drive

			if (gemKey === 'drums') {
				bpFilter.type = 'lowpass'
				bpFilter.frequency.value = drummerProfile ? 4500 : 3200
				bpFilter.Q.value = Math.SQRT1_2

				if (customDrumSaturation && customDrumSaturation !== 'album_default') {
					activeSatType = customDrumSaturation
				} else if (drummerProfile) {
					activeSatType = drummerProfile.saturation
				}
				if (customDrumDrive !== undefined) activeDrive = customDrumDrive

				if (drummerProfile) {
					const kickSnap = offlineCtx.createBiquadFilter()
					kickSnap.type = 'peaking'
					kickSnap.frequency.value = drummerProfile.eq.kickPunchHz
					kickSnap.gain.value = drummerProfile.eq.kickPunchGainDb || 3.5
					extraFilters.push(kickSnap)
				}
			} else if (gemKey === 'bass') {
				bpFilter.type = 'lowpass'
				bpFilter.frequency.value = bassistProfile?.eq?.subBassHz ? 350 : 220
				bpFilter.Q.value = Math.SQRT1_2

				if (customBassSaturation && customBassSaturation !== 'album_default') {
					activeSatType = customBassSaturation
				} else if (bassistProfile) {
					activeSatType = bassistProfile.saturation
				}
				if (customBassDrive !== undefined) activeDrive = customBassDrive

				if (bassistProfile) {
					const gritPeak = offlineCtx.createBiquadFilter()
					gritPeak.type = 'peaking'
					gritPeak.frequency.value = bassistProfile.eq.growlMidHz
					gritPeak.gain.value = bassistProfile.eq.growlMidGainDb || 4.0
					extraFilters.push(gritPeak)
				}
			} else if (gemKey === 'guitars') {
				bpFilter.type = 'bandpass'
				bpFilter.frequency.value = 2200
				bpFilter.Q.value = 0.85

				if (customGuitarDistortion && customGuitarDistortion !== 'album_default') {
					activeSatType = customGuitarDistortion
				}
				if (customGuitarDrive !== undefined) activeDrive = customGuitarDrive
			} else if (gemKey === 'vocals') {
				bpFilter.type = 'peaking'
				bpFilter.frequency.value = 2800
				bpFilter.gain.value = 2.5
				bpFilter.Q.value = 1.0
			} else {
				bpFilter.type = 'highpass'
				bpFilter.frequency.value = 4500
				bpFilter.Q.value = Math.SQRT1_2
			}

			// Saturation Stage
			const satNode = offlineCtx.createWaveShaper()
			satNode.curve = generateSaturationCurve(activeSatType, activeDrive)
			satNode.oversample = '4x'

			// Tone EQ Tilt
			const toneFilter = offlineCtx.createBiquadFilter()
			toneFilter.type = fader.toneDb >= 0 ? 'highshelf' : 'lowshelf'
			toneFilter.frequency.value = fader.toneDb >= 0 ? 4000 : 250
			toneFilter.gain.value = Math.abs(fader.toneDb)

			const gemGainNode = offlineCtx.createGain()
			gemGainNode.gain.value = 1.0

			srcNode.connect(bpFilter)
			bpFilter.connect(satNode)

			let lastNode: AudioNode = satNode
			extraFilters.forEach((f) => {
				lastNode.connect(f)
				lastNode = f
			})

			lastNode.connect(toneFilter)
			toneFilter.connect(gemGainNode)
			gemGainNode.connect(offlineCtx.destination)

			srcNode.start(0)
			const renderedGem = await offlineCtx.startRendering()
			const gemBlob = audioBufferTo24BitWavBlob(renderedGem)
			const stats = calculateBufferStats(renderedGem)

			individualGems.push({
				gemName: gemKey,
				buffer: renderedGem,
				blob: gemBlob,
				stats,
			})
		}

		// ─── MASTER ANALOG SUMMING & WELDING ──────────────────────────────────────
		onProgress?.(70, 'Iniciando soldagem analógica dos Gems no Barramento Master...')

		const summingCtx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr)

		// Summing blend with fader volumes, pan, mute, and solo
		individualGems.forEach((gem) => {
			const gSrc = summingCtx.createBufferSource()
			gSrc.buffer = gem.buffer

			const gConf = album.gemSetup[gem.gemName]
			const fader = gemFaders[gem.gemName] || {
				volumeDb: 0,
				pan: 0,
				toneDb: 0,
				mute: false,
				solo: false,
			}

			// Determine mute/solo state
			let isAudible = true
			if (hasSolo) {
				isAudible = fader.solo
			} else if (fader.mute) {
				isAudible = false
			}

			const totalVolDb = (gConf?.volumeDb !== undefined ? gConf.volumeDb : 0.0) + fader.volumeDb
			const gGain = summingCtx.createGain()
			gGain.gain.value = isAudible ? 10 ** (totalVolDb / 20) * 0.2 : 0.0

			// Pan Node
			const panner = summingCtx.createStereoPanner()
			panner.pan.value = Math.max(-1.0, Math.min(1.0, fader.pan))

			gSrc.connect(panner)
			panner.connect(gGain)
			gGain.connect(summingCtx.destination)
			gSrc.start(0)
		})

		onProgress?.(85, 'Aplicando cola de master bus e normalização True-Peak -0.50 dBFS...')
		const rawSummedBuffer = await summingCtx.startRendering()

		// Secondary Mastering Stage with Bus Compressor, Tape Glue and 8x Sinc True-Peak Limiter
		const masterStageCtx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr)
		const mSrc = masterStageCtx.createBufferSource()
		mSrc.buffer = rawSummedBuffer

		const masterGlue = masterStageCtx.createDynamicsCompressor()
		masterGlue.threshold.value = -16
		masterGlue.ratio.value = 3.0
		masterGlue.attack.value = 0.025 // 25ms
		masterGlue.release.value = 0.1 // 100ms
		masterGlue.knee.value = 4

		const masterTape = masterStageCtx.createWaveShaper()
		masterTape.curve = generateSaturationCurve('tape_warmth', 0.35)
		masterTape.oversample = '4x'

		mSrc.connect(masterGlue)
		masterGlue.connect(masterTape)
		masterTape.connect(masterStageCtx.destination)
		mSrc.start(0)

		const weldedBuffer = await masterStageCtx.startRendering()

		// True Peak Normalization to -0.50 dBFS (Zero Clipping Guaranteed)
		normalizeBufferToCeiling(weldedBuffer, -0.5)

		const weldedWavBlob = audioBufferTo24BitWavBlob(weldedBuffer)
		const finalStats = calculateBufferStats(weldedBuffer)
		const cleanAlbum = `${album.band}_${album.albumTitle}`.replace(/[^a-zA-Z0-9_-]/g, '_')
		const downloadFilename = `WELDED_MASTER_${cleanAlbum}_24bit.wav`

		onProgress?.(100, `✅ Soldagem Analógica dos Gems Concluída com Sucesso!`)

		return {
			individualGems,
			weldedBuffer,
			weldedWavBlob,
			stats: finalStats,
			downloadFilename,
		}
	}
}
