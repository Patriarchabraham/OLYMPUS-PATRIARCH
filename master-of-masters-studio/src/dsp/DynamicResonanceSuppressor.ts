/**
 * Master of Masters Studio Pro — Dynamic Resonance Suppressor (Soothe/Gullfoss Class).
 *
 * Tracks mobile, harsh harmonic resonances in real-time across critical listening bands
 * (especially 2.2kHz - 5.5kHz guitar fizz and 6.5kHz - 9.5kHz sibilance/cymbals)
 * and dynamically attenuates offending peaks without stripping musical energy or air.
 */

export class DynamicResonanceSuppressor {
	/**
	 * Processes stereo channels with adaptive dynamic resonance suppression.
	 * Isolates harsh resonance bands (3.2kHz boxiness, 4.6kHz AI fizz, 7.8kHz harsh sibilance)
	 * using precision 2-pole Biquad Bandpass filters with zero low-frequency/DC phase smear.
	 */
	public static processAdaptiveDeHarsh(
		inputLeft: Float32Array,
		inputRight: Float32Array,
		depth = 0.6,
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const length = inputLeft.length
		const outL = new Float32Array(length)
		const outR = new Float32Array(length)

		if (depth <= 0.01) {
			outL.set(inputLeft)
			outR.set(inputRight)
			return { left: outL, right: outR }
		}

		const intensity = Math.min(1.0, Math.max(0.1, depth))

		// Target resonant harshness center frequencies and Q values
		const bands = [
			{ freq: 3200.0, q: 3.2, thresh: 0.12, maxAtten: 0.5 }, // Guitar/Vocal bite
			{ freq: 4600.0, q: 3.5, thresh: 0.1, maxAtten: 0.55 }, // AI digital fizz / buzz
			{ freq: 7800.0, q: 3.0, thresh: 0.08, maxAtten: 0.45 }, // Harsh cymbals / sibilance
		]

		// Compute Biquad Bandpass filter coefficients (constant 0dB peak gain)
		const filters = bands.map((b) => {
			const w0 = (2.0 * Math.PI * b.freq) / sampleRate
			const cosw0 = Math.cos(w0)
			const sinw0 = Math.sin(w0)
			const alpha = sinw0 / (2.0 * b.q)

			const a0 = 1.0 + alpha
			return {
				b0: alpha / a0,
				b1: 0.0,
				b2: -alpha / a0,
				a1: (-2.0 * cosw0) / a0,
				a2: (1.0 - alpha) / a0,
				thresh: b.thresh,
				maxAtten: b.maxAtten,
			}
		})

		const numBands = filters.length

		// Filter state variables [band][channel]
		const x1L = new Float32Array(numBands)
		const x2L = new Float32Array(numBands)
		const y1L = new Float32Array(numBands)
		const y2L = new Float32Array(numBands)

		const x1R = new Float32Array(numBands)
		const x2R = new Float32Array(numBands)
		const y1R = new Float32Array(numBands)
		const y2R = new Float32Array(numBands)

		const env = new Float32Array(numBands)

		// Ballistics: Attack ~1.5ms, Release ~35ms
		const alphaAtt = Math.exp((-2.0 * Math.PI * 100.0) / sampleRate)
		const alphaRel = Math.exp((-2.0 * Math.PI * 28.0) / sampleRate)

		for (let i = 0; i < length; i++) {
			const l = inputLeft[i]
			const r = inputRight[i]

			let reductionSumL = 0.0
			let reductionSumR = 0.0

			for (let b = 0; b < numBands; b++) {
				const f = filters[b]

				// Process Left Channel Biquad Bandpass
				const bpL = f.b0 * l + f.b1 * x1L[b] + f.b2 * x2L[b] - f.a1 * y1L[b] - f.a2 * y2L[b]
				x2L[b] = x1L[b]
				x1L[b] = l
				y2L[b] = y1L[b]
				y1L[b] = bpL

				// Process Right Channel Biquad Bandpass
				const bpR = f.b0 * r + f.b1 * x1R[b] + f.b2 * x2R[b] - f.a1 * y1R[b] - f.a2 * y2R[b]
				x2R[b] = x1R[b]
				x1R[b] = r
				y2R[b] = y1R[b]
				y1R[b] = bpR

				// Envelope detection on combined band magnitude
				const bandMag = (Math.abs(bpL) + Math.abs(bpR)) * 0.5
				if (bandMag > env[b]) {
					env[b] = alphaAtt * env[b] + (1.0 - alphaAtt) * bandMag
				} else {
					env[b] = alphaRel * env[b] + (1.0 - alphaRel) * bandMag
				}

				// Dynamic suppression factor
				if (env[b] > f.thresh) {
					const excess = env[b] - f.thresh
					const attenFactor = Math.min(f.maxAtten * intensity, excess * 2.5 * intensity)
					reductionSumL += bpL * attenFactor
					reductionSumR += bpR * attenFactor
				}
			}

			// Pristine dynamic notch output: subtract only the isolated resonant excess
			outL[i] = l - reductionSumL
			outR[i] = r - reductionSumR
		}

		return { left: outL, right: outR }
	}
}
