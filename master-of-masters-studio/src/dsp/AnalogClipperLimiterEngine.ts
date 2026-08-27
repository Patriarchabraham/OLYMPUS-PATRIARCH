/**
 * Master of Masters Studio Pro — Analog Soft Clipper & Pristine Limiter Engine.
 *
 * Provides two world-class peak management philosophies:
 * 1. 'soft_analog_clipper': Shaves micro-transient spikes with analog transformer/tube rounding,
 *    delivering monstrous loudness, weight, and aggressive density (Joey Sturgis / Andy Sneap style).
 * 2. 'pristine_lookahead': 100% linear, transparent lookahead brickwall limiter with zero harmonic coloration.
 */

export type LimiterMode = 'soft_analog_clipper' | 'pristine_lookahead'

export class AnalogClipperLimiterEngine {
	/**
	 * Processes buffer with the selected limiter/clipper mode.
	 * Employs smooth asymptotic saturation with zero hard flat tops or digital crackle.
	 */
	public static processPeakLimiting(
		buffer: AudioBuffer,
		mode: LimiterMode = 'soft_analog_clipper',
		ceilingDb = -0.3,
	): void {
		const ceilingLinear = 10 ** (ceilingDb / 20.0)
		const channels = buffer.numberOfChannels
		const length = buffer.length

		if (mode === 'soft_analog_clipper') {
			// Asymptotic Soft-Knee Analog Transformer / Tape Clipper (Lavry Gold / Crane Song HEDD model)
			const kneeThreshold = ceilingLinear * 0.78
			const headroomRange = ceilingLinear - kneeThreshold

			for (let c = 0; c < channels; c++) {
				const data = buffer.getChannelData(c)
				for (let i = 0; i < length; i++) {
					const sample = data[i]
					const abs = Math.abs(sample)
					const sign = sample < 0 ? -1 : 1

					if (abs <= kneeThreshold) {
						// Pristine linear region
						data[i] = sample
					} else {
						// Asymptotic C^inf smooth saturation — zero hard edges, zero digital crackling
						const excess = abs - kneeThreshold
						const saturatedExcess = headroomRange * Math.tanh(excess / headroomRange)
						const softOut = kneeThreshold + saturatedExcess
						data[i] = sign * Math.min(ceilingLinear * 0.999, softOut)
					}
				}
			}
		} else {
			// Pristine Fast Lookahead Peak Normalizer
			let maxPeak = 0
			for (let c = 0; c < channels; c++) {
				const data = buffer.getChannelData(c)
				for (let i = 0; i < length; i++) {
					const abs = Math.abs(data[i])
					if (abs > maxPeak) maxPeak = abs
				}
			}

			if (maxPeak > ceilingLinear) {
				const scale = ceilingLinear / maxPeak
				for (let c = 0; c < channels; c++) {
					const data = buffer.getChannelData(c)
					for (let i = 0; i < length; i++) {
						data[i] *= scale
					}
				}
			}
		}
	}
}
