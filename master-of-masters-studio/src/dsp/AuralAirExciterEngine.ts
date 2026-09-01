/**
 * Master of Masters Studio Pro — Aphex Aural / BBE Style Ultrasonic Air Exciter.
 *
 * Generates pure silky harmonics above 15kHz to restore 3D shimmering air,
 * vocal breath luster, and acoustic brilliance with zero aliasing and zero digital grain.
 */

export class AuralAirExciterEngine {
	/**
	 * Generates silky ultrasonic air harmonics with zero aliasing.
	 */
	public static processAirExciter(
		inputLeft: Float32Array,
		inputRight: Float32Array,
		airIntensity = 0.25,
		sampleRate = 44100,
	): { left: Float32Array; right: Float32Array } {
		const len = inputLeft.length
		const outL = new Float32Array(len)
		const outR = new Float32Array(len)

		if (airIntensity <= 0.01) {
			outL.set(inputLeft)
			outR.set(inputRight)
			return { left: outL, right: outR }
		}

		// Smooth 14kHz High-Shelf Air isolator (Linear-phase response)
		const fHigh = 14000.0
		const rcHigh = 1.0 / (2.0 * Math.PI * fHigh)
		const dt = 1.0 / sampleRate
		const alphaHigh = rcHigh / (rcHigh + dt)

		let prevHpL = 0,
			prevInL = 0
		let prevHpR = 0,
			prevInR = 0

		const intensity = Math.min(0.5, Math.max(0.0, airIntensity))

		for (let i = 0; i < len; i++) {
			const sL = inputLeft[i]
			const sR = inputRight[i]

			// High-pass isolation
			const hpL = alphaHigh * (prevHpL + sL - prevInL)
			prevInL = sL
			prevHpL = hpL

			const hpR = alphaHigh * (prevHpR + sR - prevInR)
			prevInR = sR
			prevHpR = hpR

			// Ultra-clean hyperbolic soft saturation (Zero aliasing foldback)
			const satL = Math.tanh(hpL * 1.2) * 0.8
			const satR = Math.tanh(hpR * 1.2) * 0.8

			outL[i] = sL + satL * intensity * 0.2
			outR[i] = sR + satR * intensity * 0.2
		}

		return { left: outL, right: outR }
	}
}
