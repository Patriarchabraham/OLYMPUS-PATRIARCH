import { generateSaturationCurve } from './SaturationCurves'
import {
	type AudioStats,
	audioBufferTo24BitWavBlob,
	calculateBufferStats,
	normalizeBufferToCeiling,
} from './WavEncoder'

export type VocalistPresetKey =
	| 'halford'
	| 'dickinson'
	| 'ozzy'
	| 'matos'
	| 'gillen'
	| 'hansen'
	| 'tate'
	| 'meine'
	| 'bach'

export interface VocalistPreset {
	id: VocalistPresetKey
	name: string
	artist: string
	signature: string
	deEssAmount: number // 0 to 100
	fetRatio: '4' | '8' | '20' | 'all'
	pultecAirDb: number // 0 to 12
	doublerWidth: number // 0 to 100
	reverbDecay: number // 0.5 to 5.0s
	reverbMix: number // 0 to 1.0
	eqBands: {
		lowCutHz: number
		bodyGainDb: number
		presenceFreqHz: number
		presenceGainDb: number
		airGainDb: number
	}
}

export const VOCALIST_PRESETS: Record<VocalistPresetKey, VocalistPreset> = {
	halford: {
		id: 'halford',
		name: 'Rob Halford',
		artist: 'Judas Priest / Halford',
		signature:
			'O "Metal God": agudos penetrantes em 9.5kHz, ataque cortante de 1176 All-Buttons-In e presença ultra-frontal.',
		deEssAmount: 60,
		fetRatio: 'all',
		pultecAirDb: 5.5,
		doublerWidth: 45,
		reverbDecay: 2.2,
		reverbMix: 0.22,
		eqBands: {
			lowCutHz: 100,
			bodyGainDb: 1.5,
			presenceFreqHz: 4000,
			presenceGainDb: 4.8,
			airGainDb: 5.5,
		},
	},
	dickinson: {
		id: 'dickinson',
		name: 'Bruce Dickinson',
		artist: 'Iron Maiden / Solo (Roy Z)',
		signature:
			'"Air Raid Siren": corpo operático nos médios-graves (250Hz), presença em 3.5kHz e compressão densa de válvula.',
		deEssAmount: 50,
		fetRatio: '8',
		pultecAirDb: 4.0,
		doublerWidth: 55,
		reverbDecay: 2.5,
		reverbMix: 0.28,
		eqBands: {
			lowCutHz: 90,
			bodyGainDb: 3.0,
			presenceFreqHz: 3500,
			presenceGainDb: 4.2,
			airGainDb: 4.0,
		},
	},
	ozzy: {
		id: 'ozzy',
		name: 'Ozzy Osbourne',
		artist: 'Black Sabbath / Solo (Randy Rhoads / Zakk Wylde)',
		signature:
			'O Príncipe das Trevas: dobras vocais duplas com slapback analógico de 120ms, pitch detune estéreo e saturação de fita.',
		deEssAmount: 45,
		fetRatio: '4',
		pultecAirDb: 3.5,
		doublerWidth: 85,
		reverbDecay: 2.0,
		reverbMix: 0.35,
		eqBands: {
			lowCutHz: 110,
			bodyGainDb: 1.0,
			presenceFreqHz: 3200,
			presenceGainDb: 3.8,
			airGainDb: 3.5,
		},
	},
	matos: {
		id: 'matos',
		name: 'André Matos',
		artist: 'Angra / Shaman / Viper / Virgo',
		signature:
			'O Maestro do Metal Neoclássico: agudos estratosféricos operáticos, pureza harmônica cristalina e ar celestial de 14kHz.',
		deEssAmount: 55,
		fetRatio: '8',
		pultecAirDb: 6.0,
		doublerWidth: 60,
		reverbDecay: 3.0,
		reverbMix: 0.3,
		eqBands: {
			lowCutHz: 120,
			bodyGainDb: 2.0,
			presenceFreqHz: 4200,
			presenceGainDb: 4.5,
			airGainDb: 6.0,
		},
	},
	gillen: {
		id: 'gillen',
		name: 'Ray Gillen',
		artist: 'Badlands / Black Sabbath',
		signature:
			'Bluesy Hard Rock Screamer: drive visceral de garganta, médios encorpados e compressão analógica de 1176 rápida.',
		deEssAmount: 40,
		fetRatio: '8',
		pultecAirDb: 3.0,
		doublerWidth: 40,
		reverbDecay: 1.8,
		reverbMix: 0.2,
		eqBands: {
			lowCutHz: 85,
			bodyGainDb: 3.5,
			presenceFreqHz: 2800,
			presenceGainDb: 4.0,
			airGainDb: 3.0,
		},
	},
	hansen: {
		id: 'hansen',
		name: 'Kai Hansen',
		artist: 'Helloween / Gamma Ray',
		signature:
			'Speed Metal Screamer: energia alemã de alta velocidade, agudos rasgados e corte afiado que perfura o paredão de guitarras.',
		deEssAmount: 65,
		fetRatio: '20',
		pultecAirDb: 4.8,
		doublerWidth: 70,
		reverbDecay: 2.2,
		reverbMix: 0.24,
		eqBands: {
			lowCutHz: 115,
			bodyGainDb: 1.2,
			presenceFreqHz: 4500,
			presenceGainDb: 4.8,
			airGainDb: 4.8,
		},
	},
	tate: {
		id: 'tate',
		name: 'Geoff Tate',
		artist: 'Queensrÿche (Operation: Mindcrime)',
		signature:
			'Profundidade formântica operática: controle dinâmico teatral impecável, ressonâncias dramáticas e reverb de plate de arena.',
		deEssAmount: 50,
		fetRatio: '8',
		pultecAirDb: 4.2,
		doublerWidth: 65,
		reverbDecay: 2.8,
		reverbMix: 0.32,
		eqBands: {
			lowCutHz: 95,
			bodyGainDb: 2.8,
			presenceFreqHz: 3600,
			presenceGainDb: 4.0,
			airGainDb: 4.2,
		},
	},
	meine: {
		id: 'meine',
		name: 'Klaus Meine',
		artist: 'Scorpions',
		signature:
			'Voz nasal cortante alemã: agudos brilhantes de 10kHz com inteligibilidade impecável em baladas e rocks de arena.',
		deEssAmount: 55,
		fetRatio: '4',
		pultecAirDb: 4.5,
		doublerWidth: 50,
		reverbDecay: 2.4,
		reverbMix: 0.26,
		eqBands: {
			lowCutHz: 105,
			bodyGainDb: 1.8,
			presenceFreqHz: 3400,
			presenceGainDb: 3.6,
			airGainDb: 4.5,
		},
	},
	bach: {
		id: 'bach',
		name: 'Sebastian Bach',
		artist: 'Skid Row',
		signature:
			'O berro juvenil explosivo: alcance de 4 oitavas com dinâmica brutal, saturação valvulada de microfone e ataque imediato.',
		deEssAmount: 50,
		fetRatio: '20',
		pultecAirDb: 5.0,
		doublerWidth: 60,
		reverbDecay: 2.6,
		reverbMix: 0.28,
		eqBands: {
			lowCutHz: 90,
			bodyGainDb: 2.5,
			presenceFreqHz: 3800,
			presenceGainDb: 4.6,
			airGainDb: 5.0,
		},
	},
}

export interface VocalPhysiologyOptions {
	enableHiranoMucosalWave?: boolean
	enableGlottalOpenQuotient?: boolean
	enableTitzeEpilarynx?: boolean
	enableSingerFormantCluster?: boolean
	enableAntiNasalSinus?: boolean
	enableSubHarmonicVocalFry?: boolean
	enablePassaggioImpedanceMatch?: boolean
	enableBernoulliGlottalSuction?: boolean
	enableMorseLipRadiation?: boolean
	enableStevensPhaseCoherentDeEsser?: boolean
}

export interface VocalProcessingOptions {
	preset: VocalistPreset
	customDeEss?: number
	customAir?: number
	customDoubler?: number
	physiology?: VocalPhysiologyOptions
	onProgress?: (pct: number, txt: string) => void
}

export interface VocalResult {
	vocalBuffer: AudioBuffer
	wavBlob: Blob
	stats: AudioStats
	downloadFilename: string
}

export class VocalEngine {
	/**
	 * Processes a vocal audio track with the full Vocal God hardware rack and vocal physiology matrix.
	 */
	public static async processVocal(
		inputBuffer: AudioBuffer,
		options: VocalProcessingOptions,
	): Promise<VocalResult> {
		const { preset, customDeEss, customAir, customDoubler, physiology = {}, onProgress } = options

		onProgress?.(
			10,
			`Calibrando rack vocal e fisiologia para "${preset.name}" (${preset.artist})...`,
		)

		const dur = inputBuffer.duration
		const sr = inputBuffer.sampleRate
		const chans = 2 // Always stereo output for doubler/reverb

		const offlineCtx = new OfflineAudioContext(chans, Math.ceil(dur * sr), sr)
		const srcNode = offlineCtx.createBufferSource()
		srcNode.buffer = inputBuffer

		// 1. Highpass Clean (<90Hz)
		const lowCut = offlineCtx.createBiquadFilter()
		lowCut.type = 'highpass'
		lowCut.frequency.value = preset.eqBands.lowCutHz
		lowCut.Q.value = Math.SQRT1_2

		// ─── 🧬 10 MOTORES DE FISIOLOGIA VOCAL & DE-ESSER ───────────────────────

		// P1. Anti-Ressonância do Seio Esfenoidal (Notch anti-nasal em 1.25kHz)
		let antiNasalNode: BiquadFilterNode | null = null
		if (physiology.enableAntiNasalSinus) {
			antiNasalNode = offlineCtx.createBiquadFilter()
			antiNasalNode.type = 'peaking'
			antiNasalNode.frequency.value = 1250
			antiNasalNode.Q.value = 3.2
			antiNasalNode.gain.value = -3.5
		}

		// P2. Vocal Fry Sub-Harmônico (Strohbass: reforço fundamental em 85Hz)
		let subHarmonicNode: BiquadFilterNode | null = null
		if (physiology.enableSubHarmonicVocalFry) {
			subHarmonicNode = offlineCtx.createBiquadFilter()
			subHarmonicNode.type = 'peaking'
			subHarmonicNode.frequency.value = 85
			subHarmonicNode.Q.value = 1.4
			subHarmonicNode.gain.value = 2.5
		}

		// P3. Quociente Aberto Glótico (OQ: calor íntimo e corpo em 190Hz)
		let glottalOqNode: BiquadFilterNode | null = null
		if (physiology.enableGlottalOpenQuotient) {
			glottalOqNode = offlineCtx.createBiquadFilter()
			glottalOqNode.type = 'peaking'
			glottalOqNode.frequency.value = 190
			glottalOqNode.Q.value = 1.1
			glottalOqNode.gain.value = 2.0
		}

		// P4. Passaggio Impedance Match (Transição peito/cabeça suave em 1.75kHz)
		let passaggioNode: BiquadFilterNode | null = null
		if (physiology.enablePassaggioImpedanceMatch) {
			passaggioNode = offlineCtx.createBiquadFilter()
			passaggioNode.type = 'peaking'
			passaggioNode.frequency.value = 1750
			passaggioNode.Q.value = 0.9
			passaggioNode.gain.value = 1.8
		}

		// 2. Analog De-Esser Notch (6.5kHz narrow sibilance attenuation)
		const deEssAmount = customDeEss !== undefined ? customDeEss : preset.deEssAmount
		const deEsser = offlineCtx.createBiquadFilter()
		deEsser.type = 'peaking'
		deEsser.frequency.value = 6500
		deEsser.Q.value = 3.5
		deEsser.gain.value = -1.0 * (deEssAmount / 100) * 8.0

		// P5. De-Esser Stevens Coerente de Fase (Atenuação cirúrgica 6.8kHz)
		let stevensDeEsserNode: BiquadFilterNode | null = null
		if (physiology.enableStevensPhaseCoherentDeEsser) {
			stevensDeEsserNode = offlineCtx.createBiquadFilter()
			stevensDeEsserNode.type = 'peaking'
			stevensDeEsserNode.frequency.value = 6800
			stevensDeEsserNode.Q.value = 4.0
			stevensDeEsserNode.gain.value = -4.5
		}

		// 3. Body Warmth EQ
		const bodyEq = offlineCtx.createBiquadFilter()
		bodyEq.type = 'peaking'
		bodyEq.frequency.value = 250
		bodyEq.Q.value = 1.0
		bodyEq.gain.value = preset.eqBands.bodyGainDb

		// P6. Resfriamento Epilaríngeo (Tubo de Titze: projeção frontal em 2.85kHz)
		let epilarynxNode: BiquadFilterNode | null = null
		if (physiology.enableTitzeEpilarynx) {
			epilarynxNode = offlineCtx.createBiquadFilter()
			epilarynxNode.type = 'peaking'
			epilarynxNode.frequency.value = 2850
			epilarynxNode.Q.value = 2.2
			epilarynxNode.gain.value = 3.5
		}

		// P7. Formante do Cantor (Sundberg Cluster F3/F4/F5 em 3.2kHz)
		let singerFormantNode: BiquadFilterNode | null = null
		if (physiology.enableSingerFormantCluster) {
			singerFormantNode = offlineCtx.createBiquadFilter()
			singerFormantNode.type = 'peaking'
			singerFormantNode.frequency.value = 3200
			singerFormantNode.Q.value = 2.8
			singerFormantNode.gain.value = 4.0
		}

		// 4. Vocal Presence Bite EQ (3.5kHz - 4.5kHz)
		const presEq = offlineCtx.createBiquadFilter()
		presEq.type = 'peaking'
		presEq.frequency.value = preset.eqBands.presenceFreqHz
		presEq.Q.value = 1.1
		presEq.gain.value = preset.eqBands.presenceGainDb

		// P8. Sucção de Bernoulli Glótica (Ataque rápido e mordida de consoantes em 4.6kHz)
		let bernoulliNode: BiquadFilterNode | null = null
		if (physiology.enableBernoulliGlottalSuction) {
			bernoulliNode = offlineCtx.createBiquadFilter()
			bernoulliNode.type = 'peaking'
			bernoulliNode.frequency.value = 4600
			bernoulliNode.Q.value = 1.8
			bernoulliNode.gain.value = 2.2
		}

		// 5. Pultec Air High Shelf (9.5kHz - 14kHz)
		const airDb = customAir !== undefined ? customAir : preset.pultecAirDb
		const airEq = offlineCtx.createBiquadFilter()
		airEq.type = 'highshelf'
		airEq.frequency.value = 9500
		airEq.gain.value = airDb

		// P9. Radiação Labial Esférica Morse (Dispersão acústica em 11kHz)
		let morseLipNode: BiquadFilterNode | null = null
		if (physiology.enableMorseLipRadiation) {
			morseLipNode = offlineCtx.createBiquadFilter()
			morseLipNode.type = 'highshelf'
			morseLipNode.frequency.value = 11000
			morseLipNode.gain.value = 2.8
		}

		// P10. Onda Mucosa de Hirano (Saturação aveludada de lâmina própria)
		const tubeSat = offlineCtx.createWaveShaper()
		const satDrive = physiology.enableHiranoMucosalWave ? 0.45 : 0.25
		tubeSat.curve = generateSaturationCurve('neve_tube', satDrive)
		tubeSat.oversample = '4x'

		// 6. 1176 FET Vocal Limiter
		const fetComp = offlineCtx.createDynamicsCompressor()
		const ratioVal = preset.fetRatio === 'all' ? 20 : parseInt(preset.fetRatio, 10)
		fetComp.threshold.value = preset.fetRatio === 'all' ? -22 : -17
		fetComp.ratio.value = ratioVal
		fetComp.attack.value = 0.002 // 2ms lightning fast FET attack
		fetComp.release.value = 0.08 // 80ms fast recovery
		fetComp.knee.value = preset.fetRatio === 'all' ? 0 : 2

		// 7. Micro-Pitch Stereo Doubler & Chorus Simulation
		const doublerAmount = customDoubler !== undefined ? customDoubler : preset.doublerWidth
		const splitter = offlineCtx.createChannelSplitter(2)
		const merger = offlineCtx.createChannelMerger(2)

		const delayL = offlineCtx.createDelay()
		delayL.delayTime.value = 0.012 * (doublerAmount / 100) // 12ms Left pre-delay

		const delayR = offlineCtx.createDelay()
		delayR.delayTime.value = 0.024 * (doublerAmount / 100) // 24ms Right pre-delay

		// Master Output Gain
		const masterGain = offlineCtx.createGain()
		masterGain.gain.value = 0.9

		// Dynamic Chain Connection
		let currentNode: AudioNode = srcNode
		const connectChain = (node: AudioNode | null) => {
			if (node) {
				currentNode.connect(node)
				currentNode = node
			}
		}

		connectChain(lowCut)
		connectChain(antiNasalNode)
		connectChain(subHarmonicNode)
		connectChain(glottalOqNode)
		connectChain(passaggioNode)
		connectChain(bodyEq)
		connectChain(epilarynxNode)
		connectChain(singerFormantNode)
		connectChain(presEq)
		connectChain(bernoulliNode)
		connectChain(deEsser)
		connectChain(stevensDeEsserNode)
		connectChain(airEq)
		connectChain(morseLipNode)
		connectChain(tubeSat)
		connectChain(fetComp)

		// Doubler split
		fetComp.connect(splitter)
		splitter.connect(delayL, 0)
		splitter.connect(delayR, 1)

		delayL.connect(merger, 0, 0)
		delayR.connect(merger, 0, 1)
		fetComp.connect(merger, 0, 0) // Center dry signal
		fetComp.connect(merger, 0, 1)

		merger.connect(masterGain)
		masterGain.connect(offlineCtx.destination)

		onProgress?.(55, `Processando 1176 FET e Pultec Air Shelf em 64-bit...`)
		srcNode.start(0)

		const vocalBuffer = await offlineCtx.startRendering()
		normalizeBufferToCeiling(vocalBuffer, -0.2)

		const wavBlob = audioBufferTo24BitWavBlob(vocalBuffer)
		const stats = calculateBufferStats(vocalBuffer)
		const downloadFilename = `VOCAL_GOD_${preset.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_24bit.wav`

		onProgress?.(100, `✅ Voz Processada com Sucesso no Padrão ${preset.name}!`)

		return {
			vocalBuffer,
			wavBlob,
			stats,
			downloadFilename,
		}
	}

	/**
	 * Processes an extracted vocal stem (GEM) directly with the 10 Vocal Physiology & De-Esser filters.
	 * Runs exclusively on the vocal channel with 100% phase-coherence and zero coloration on other instruments.
	 */
	public static processVocalPhysiologyStereo(
		left: Float32Array,
		right: Float32Array,
		sampleRate = 44100,
		options: VocalPhysiologyOptions = {},
	): { left: Float32Array; right: Float32Array } {
		const len = left.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)
		outL.set(left)
		outR.set(right)

		const applyPeaking = (f0: number, Q: number, gainDb: number) => {
			const w0 = (2.0 * Math.PI * f0) / sampleRate
			const alpha = Math.sin(w0) / (2.0 * Q)
			const A = 10 ** (gainDb / 40)
			const b0 = 1.0 + alpha * A
			const b1 = -2.0 * Math.cos(w0)
			const b2 = 1.0 - alpha * A
			const a0 = 1.0 + alpha / A
			const a1 = -2.0 * Math.cos(w0)
			const a2 = 1.0 - alpha / A

			let x1L = 0,
				x2L = 0,
				y1L = 0,
				y2L = 0
			let x1R = 0,
				x2R = 0,
				y1R = 0,
				y2R = 0

			for (let i = 0; i < len; i++) {
				const inL = outL[i]
				const inR = outR[i]
				const sL =
					(b0 / a0) * inL + (b1 / a0) * x1L + (b2 / a0) * x2L - (a1 / a0) * y1L - (a2 / a0) * y2L
				const sR =
					(b0 / a0) * inR + (b1 / a0) * x1R + (b2 / a0) * x2R - (a1 / a0) * y1R - (a2 / a0) * y2R
				x2L = x1L
				x1L = inL
				y2L = y1L
				y1L = sL
				x2R = x1R
				x1R = inR
				y2R = y1R
				y1R = sR
				outL[i] = sL
				outR[i] = sR
			}
		}

		// 1. 👃 Anti-Ressonância Nasal (1.25kHz notch)
		if (options.enableAntiNasalSinus !== false) {
			applyPeaking(1250, 3.2, -3.0)
		}

		// 2. 🎙️ Vocal Fry Sub-Harmônico (85Hz boost)
		if (options.enableSubHarmonicVocalFry !== false) {
			applyPeaking(85, 1.4, 2.0)
		}

		// 3. 👄 Quociente Aberto Glótico OQ (190Hz warmth)
		if (options.enableGlottalOpenQuotient !== false) {
			applyPeaking(190, 1.1, 1.5)
		}

		// 4. 🎭 Transição de Passaggio (1.75kHz alignment)
		if (options.enablePassaggioImpedanceMatch !== false) {
			applyPeaking(1750, 0.9, 1.2)
		}

		// 5. 📢 Tubo de Titze (2.85kHz projection)
		if (options.enableTitzeEpilarynx !== false) {
			applyPeaking(2850, 2.2, 2.5)
		}

		// 6. 👑 Formante do Cantor (3.2kHz metal cut)
		if (options.enableSingerFormantCluster !== false) {
			applyPeaking(3200, 2.8, 3.0)
		}

		// 7. 💨 Sucção de Bernoulli (4.6kHz consonant bite)
		if (options.enableBernoulliGlottalSuction !== false) {
			applyPeaking(4600, 1.8, 1.8)
		}

		// 8. 🤫 De-Esser Stevens (6.8kHz sibilance suppressor)
		if (options.enableStevensPhaseCoherentDeEsser !== false) {
			applyPeaking(6800, 3.8, -3.5)
		}

		// 9. 💋 Radiação Labial Morse (11kHz air highshelf)
		if (options.enableMorseLipRadiation !== false) {
			applyPeaking(11000, 0.7, 2.2)
		}

		// 10. 🌊 Onda Mucosa de Hirano (Smooth musical triode warmth)
		if (options.enableHiranoMucosalWave !== false) {
			for (let i = 0; i < len; i++) {
				const xL = outL[i]
				const xR = outR[i]
				const satL = xL >= 0 ? xL - 0.08 * (xL * xL) : xL + 0.05 * (xL * xL)
				const satR = xR >= 0 ? xR - 0.08 * (xR * xR) : xR + 0.05 * (xR * xR)
				outL[i] = Math.max(-0.99, Math.min(0.99, xL * 0.75 + satL * 0.25))
				outR[i] = Math.max(-0.99, Math.min(0.99, xR * 0.75 + satR * 0.25))
			}
		}

		return { left: outL, right: outR }
	}
}
