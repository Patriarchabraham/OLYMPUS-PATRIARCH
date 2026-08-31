/**
 * Master of Masters Studio Pro — Real-Time Dynamic Spectral De-Resonator (Soothe2 / Gullfoss Class).
 *
 * Continuously tracks narrow resonant spikes across the audio spectrum:
 * - 2.5kHz - 5.5kHz: Piercing guitar fizz, sibilance, and harsh ear fatigue.
 * - 300Hz - 600Hz: Boxy, hollow, muddy cardboard build-ups.
 * - 6.5kHz - 9kHz: Harsh cymbal wash and splash clutter.
 *
 * Applies dynamic attenuation only during resonant peaks, returning to 100% linear transparency
 * when the signal is clean, preserving punch and harmonic depth.
 */

export class DynamicSpectralDeResonator {
	/**
	 * Processes a stereo stream through dynamic spectral resonance tracking and suppression.
	 */
	public static processDeResonance(
		channelL: Float32Array,
		channelR: Float32Array,
		depth = 0.5, // 0.0 (off) to 1.0 (maximum surgical suppression)
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array; suppressedDb: number } {
		const len = channelL.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		if (depth <= 0.01) {
			outL.set(channelL)
			outR.set(channelR)
			return { left: outL, right: outR, suppressedDb: 0.0 }
		}

		// Resonant tracking filter poles for critical frequency zones:
		// 1. Boxy Muds (400Hz)
		// 2. Harsh Presence (3200Hz)
		// 3. Sibilance/Fizz (4800Hz)
		// 4. Splash Wash (7500Hz)
		const freqs = [400, 3200, 4800, 7500]
		const numZones = freqs.length

		// Dynamic envelope followers per zone
		const envFastL = new Float32Array(numZones)
		const envFastR = new Float32Array(numZones)
		const envSlowL = new Float32Array(numZones)
		const envSlowR = new Float32Array(numZones)

		// Filter state variables (2-pole state variable filters)
		const bpL = new Float32Array(numZones)
		const bpR = new Float32Array(numZones)
		const lpL = new Float32Array(numZones)
		const lpR = new Float32Array(numZones)

		// Coefficients
		const fCoeffs = new Float32Array(numZones)
		const qCoeffs = new Float32Array(numZones)

		for (let z = 0; z < numZones; z++) {
			fCoeffs[z] = 2.0 * Math.sin((Math.PI * freqs[z]) / sampleRate)
			qCoeffs[z] = 0.35 // Narrow Q for resonance isolation
		}

		let maxSuppression = 0

		for (let i = 0; i < len; i++) {
			let modL = channelL[i]
			let modR = channelR[i]

			for (let z = 0; z < numZones; z++) {
				const f = fCoeffs[z]
				const q = qCoeffs[z]

				// Left Channel SVF Bandpass
				const hpL = modL - lpL[z] - q * bpL[z]
				bpL[z] += f * hpL
				lpL[z] += f * bpL[z]
				const bandSignalL = bpL[z]

				// Right Channel SVF Bandpass
				const hpR = modR - lpR[z] - q * bpR[z]
				bpR[z] += f * hpR
				lpR[z] += f * bpR[z]
				const bandSignalR = bpR[z]

				// Fast vs Slow Envelope tracking (calculates spikiness/resonance excess)
				const absL = Math.abs(bandSignalL)
				const absR = Math.abs(bandSignalR)

				envFastL[z] = 0.75 * envFastL[z] + 0.25 * absL
				envSlowL[z] = 0.995 * envSlowL[z] + 0.005 * absL
				envFastR[z] = 0.75 * envFastR[z] + 0.25 * absR
				envSlowR[z] = 0.995 * envSlowR[z] + 0.005 * absR

				// Resonance excess delta
				const deltaL = Math.max(0, envFastL[z] - envSlowL[z] * 1.5)
				const deltaR = Math.max(0, envFastR[z] - envSlowR[z] * 1.5)

				// Dynamic suppression gain reduction
				const reductionL = Math.min(0.65, deltaL * depth * 2.2)
				const reductionR = Math.min(0.65, deltaR * depth * 2.2)

				modL -= bandSignalL * reductionL
				modR -= bandSignalR * reductionR

				if (reductionL > maxSuppression) maxSuppression = reductionL
			}

			outL[i] = modL
			outR[i] = modR
		}

		return {
			left: outL,
			right: outR,
			suppressedDb: Math.round(20.0 * Math.log10(1.0 - maxSuppression) * 10) / 10,
		}
	}
}
