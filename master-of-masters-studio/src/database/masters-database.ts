import type { SaturationType } from '../dsp/SaturationCurves'
import { ALL_20_PRODUCERS_FULL } from './all-producers-full'
import { PRODUCERS_PART2 } from './all-producers-full-part2'
import { PRODUCERS_MIDDLE } from './all-producers-middle'
import { PRODUCERS_DREAM_THEATER_COMPLETE } from './producers-dream-theater-complete'
import { PRODUCERS_ICONS_PROG_POP } from './producers-icons-prog-pop'
import { PRODUCERS_LEGENDS_EXPANDED_DISCOGRAPHY } from './producers-legends-expanded-discography'
import { PRODUCERS_LEGENDS_ROCK_METAL } from './producers-legends-rock-metal'

export type { SaturationType }

export interface GuitarToneprint {
	ampModel: SaturationType
	cabResonanceHz: number
	midScoopHz: number
	midScoopGainDb: number
	bitePresenceHz: number
	biteGainDb: number
	cabHighCutHz: number
	distortionGain: number
	stereoSpread: number
	description: string
}

export interface TuningSignature {
	standardName: string
	baseFreqA4Hz: number
	centOffset: number
	harmonicResonanceCenterHz: number
}

export interface GemSetup {
	drums: {
		volumeDb: number
		eq: { sub: number; punch: number; attack: number; air: number }
		saturation: SaturationType
		drive: number
		compRatio: number
		compAttack: number
		compRelease: number
		description: string
	}
	bass: {
		volumeDb: number
		eq: { subBass: number; grit: number; cutMids: number; clarity: number }
		saturation: SaturationType
		drive: number
		compRatio: number
		compAttack: number
		compRelease: number
		description: string
	}
	guitars: {
		volumeDb: number
		eq: { lowCut: number; body: number; bite: number; sheen: number }
		saturation: SaturationType
		drive: number
		stereoWidth: number
		description: string
	}
	vocals: {
		volumeDb: number
		eq: { body: number; clarity: number; presence: number; air: number }
		saturation: SaturationType
		drive: number
		compRatio: number
		compAttack: number
		compRelease: number
		description: string
	}
	synthsFx: {
		volumeDb: number
		eq: { lowMids: number; presence: number; air: number }
		saturation: SaturationType
		drive: number
		stereoWidth: number
		description: string
	}
}

export interface MasterAlbumSetup {
	id: string
	albumTitle: string
	band: string
	year: number
	hardwareChain: string
	soundSignature: string
	targetLufs: number
	tuningSignature: TuningSignature
	guitarToneprint: GuitarToneprint
	eq10Band: {
		hz30: number
		hz60: number
		hz120: number
		hz250: number
		hz500: number
		hz1000: number
		hz2500: number
		hz4000: number
		hz8000: number
		hz16000: number
	}
	saturation: {
		type: SaturationType
		drive: number
	}
	compressor: {
		threshold: number
		ratio: number
		attack: number
		release: number
		knee: number
	}
	stereoWidth: number
	gemSetup: GemSetup
}

export interface MasterProducer {
	id: string
	name: string
	title: string
	category: 'metal_rock' | 'cinema' | 'classical' | 'prog_synth'
	era: string
	country: string
	bio: string
	albums: MasterAlbumSetup[]
}

export const TOP_20_METAL_ROCK_PRODUCERS: MasterProducer[] = [
	...ALL_20_PRODUCERS_FULL,
	...PRODUCERS_MIDDLE,
	...PRODUCERS_PART2,
	...PRODUCERS_LEGENDS_ROCK_METAL,
	...PRODUCERS_ICONS_PROG_POP,
	...PRODUCERS_DREAM_THEATER_COMPLETE,
	...PRODUCERS_LEGENDS_EXPANDED_DISCOGRAPHY,
]

export const ALL_MASTERS: MasterProducer[] = [...TOP_20_METAL_ROCK_PRODUCERS]
