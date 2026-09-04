/**
 * Master of Masters Studio Pro — Live Real-Time DSP Audition Engine.
 *
 * Allows instant live auditioning of Drum Kits, Guitar Rigs, Bass Rigs,
 * and Secret Producer Hacks on the live playback stream without re-rendering.
 */

import { BASS_RIGS, DRUM_KITS, GUITAR_RIGS } from './InstrumentKitMatrixEngine'
import { generateSaturationCurve } from './SaturationCurves'

export class LiveRigAuditionEngine {
	private static ctx: AudioContext | null = null
	private static isAuditionActive = false

	// Real-time DSP Nodes
	private static subHpNode: BiquadFilterNode | null = null
	private static kickThumpNode: BiquadFilterNode | null = null
	private static snareSnapNode: BiquadFilterNode | null = null
	private static guitarBiteNode: BiquadFilterNode | null = null
	private static bassGrowlNode: BiquadFilterNode | null = null
	private static airSheenNode: BiquadFilterNode | null = null
	private static satNode: WaveShaperNode | null = null
	private static liveGain: GainNode | null = null

	public static init(
		ctx: AudioContext,
		sourceNode: MediaElementAudioSourceNode,
		destNode: AudioNode,
	): void {
		LiveRigAuditionEngine.ctx = ctx
		LiveRigAuditionEngine.inputNode = sourceNode

		LiveRigAuditionEngine.subHpNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.subHpNode.type = 'highpass'
		LiveRigAuditionEngine.subHpNode.frequency.value = 30

		LiveRigAuditionEngine.kickThumpNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.kickThumpNode.type = 'peaking'
		LiveRigAuditionEngine.kickThumpNode.frequency.value = 55
		LiveRigAuditionEngine.kickThumpNode.gain.value = 0

		LiveRigAuditionEngine.snareSnapNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.snareSnapNode.type = 'peaking'
		LiveRigAuditionEngine.snareSnapNode.frequency.value = 4200
		LiveRigAuditionEngine.snareSnapNode.gain.value = 0

		LiveRigAuditionEngine.guitarBiteNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.guitarBiteNode.type = 'peaking'
		LiveRigAuditionEngine.guitarBiteNode.frequency.value = 2400
		LiveRigAuditionEngine.guitarBiteNode.gain.value = 0

		LiveRigAuditionEngine.bassGrowlNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.bassGrowlNode.type = 'peaking'
		LiveRigAuditionEngine.bassGrowlNode.frequency.value = 750
		LiveRigAuditionEngine.bassGrowlNode.gain.value = 0

		LiveRigAuditionEngine.airSheenNode = ctx.createBiquadFilter()
		LiveRigAuditionEngine.airSheenNode.type = 'highshelf'
		LiveRigAuditionEngine.airSheenNode.frequency.value = 14000
		LiveRigAuditionEngine.airSheenNode.gain.value = 0

		LiveRigAuditionEngine.satNode = ctx.createWaveShaper()
		LiveRigAuditionEngine.satNode.curve = generateSaturationCurve('tape_warmth', 0.1)
		LiveRigAuditionEngine.satNode.oversample = '2x'

		LiveRigAuditionEngine.liveGain = ctx.createGain()
		LiveRigAuditionEngine.liveGain.gain.value = 1.0

		// Connect node chain
		sourceNode.connect(LiveRigAuditionEngine.subHpNode)
		LiveRigAuditionEngine.subHpNode.connect(LiveRigAuditionEngine.kickThumpNode)
		LiveRigAuditionEngine.kickThumpNode.connect(LiveRigAuditionEngine.snareSnapNode)
		LiveRigAuditionEngine.snareSnapNode.connect(LiveRigAuditionEngine.guitarBiteNode)
		LiveRigAuditionEngine.guitarBiteNode.connect(LiveRigAuditionEngine.bassGrowlNode)
		LiveRigAuditionEngine.bassGrowlNode.connect(LiveRigAuditionEngine.airSheenNode)
		LiveRigAuditionEngine.airSheenNode.connect(LiveRigAuditionEngine.satNode)
		LiveRigAuditionEngine.satNode.connect(LiveRigAuditionEngine.liveGain)
		LiveRigAuditionEngine.liveGain.connect(destNode)
	}

	public static updateLiveRig(options: {
		enabled: boolean
		drumKitId?: string
		guitarRigId?: string
		bassRigId?: string
		secretHackId?: string
	}): void {
		LiveRigAuditionEngine.isAuditionActive = options.enabled

		if (!LiveRigAuditionEngine.isAuditionActive || !LiveRigAuditionEngine.ctx) {
			// Reset all nodes to bypass/transparent
			if (LiveRigAuditionEngine.kickThumpNode) LiveRigAuditionEngine.kickThumpNode.gain.value = 0
			if (LiveRigAuditionEngine.snareSnapNode) LiveRigAuditionEngine.snareSnapNode.gain.value = 0
			if (LiveRigAuditionEngine.guitarBiteNode) LiveRigAuditionEngine.guitarBiteNode.gain.value = 0
			if (LiveRigAuditionEngine.bassGrowlNode) LiveRigAuditionEngine.bassGrowlNode.gain.value = 0
			if (LiveRigAuditionEngine.airSheenNode) LiveRigAuditionEngine.airSheenNode.gain.value = 0
			return
		}

		// Live Drum Kit Update
		if (options.drumKitId && options.drumKitId !== 'bypass') {
			const dk = DRUM_KITS.find((d) => d.id === options.drumKitId)
			if (dk && LiveRigAuditionEngine.kickThumpNode && LiveRigAuditionEngine.snareSnapNode) {
				LiveRigAuditionEngine.kickThumpNode.frequency.value = dk.kickThumpHz
				LiveRigAuditionEngine.kickThumpNode.gain.value = 3.5
				LiveRigAuditionEngine.snareSnapNode.frequency.value = dk.snareSnapHz
				LiveRigAuditionEngine.snareSnapNode.gain.value = 2.8
			}
		} else {
			if (LiveRigAuditionEngine.kickThumpNode) LiveRigAuditionEngine.kickThumpNode.gain.value = 0
			if (LiveRigAuditionEngine.snareSnapNode) LiveRigAuditionEngine.snareSnapNode.gain.value = 0
		}

		// Live Guitar Rig Update
		if (options.guitarRigId && options.guitarRigId !== 'bypass') {
			const gr = GUITAR_RIGS.find((g) => g.id === options.guitarRigId)
			if (gr && LiveRigAuditionEngine.guitarBiteNode) {
				LiveRigAuditionEngine.guitarBiteNode.frequency.value = gr.biteFreqHz
				LiveRigAuditionEngine.guitarBiteNode.gain.value = 3.0
			}
		} else {
			if (LiveRigAuditionEngine.guitarBiteNode) LiveRigAuditionEngine.guitarBiteNode.gain.value = 0
		}

		// Live Bass Rig Update
		if (options.bassRigId && options.bassRigId !== 'bypass') {
			const br = BASS_RIGS.find((b) => b.id === options.bassRigId)
			if (br && LiveRigAuditionEngine.bassGrowlNode) {
				LiveRigAuditionEngine.bassGrowlNode.frequency.value = br.growlFreqHz
				LiveRigAuditionEngine.bassGrowlNode.gain.value = 2.5
			}
		} else {
			if (LiveRigAuditionEngine.bassGrowlNode) LiveRigAuditionEngine.bassGrowlNode.gain.value = 0
		}

		// Live Secret Hack Update
		if (
			options.secretHackId &&
			options.secretHackId !== 'bypass' &&
			LiveRigAuditionEngine.airSheenNode
		) {
			if (options.secretHackId === 'max_martin_diamond') {
				LiveRigAuditionEngine.airSheenNode.gain.value = 4.0
			} else if (options.secretHackId === 'black_album_fatness') {
				if (LiveRigAuditionEngine.kickThumpNode)
					LiveRigAuditionEngine.kickThumpNode.gain.value = 4.5
			}
		}
	}

	/**
	 * Updates live analog saturation drive and model in real-time.
	 */
	public static setSaturation(type: any, drive: number): void {
		if (!LiveRigAuditionEngine.satNode) return
		try {
			LiveRigAuditionEngine.satNode.curve = generateSaturationCurve(
				type || 'marshall_jcm800',
				Math.max(0.05, drive),
			)
		} catch {
			// Fallback
		}
	}
}
